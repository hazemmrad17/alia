"""The WebSocket handshake enforces the same ownership as the REST path.

A token proves who is asking, not that a session is theirs: without this check
any signed-in account holding a session id could drive someone else's
conversation and read the reply. The rejection happens before the socket is
accepted, so the client never gets a live connection to abandon.
"""
from __future__ import annotations

import pytest
from starlette.websockets import WebSocketDisconnect

from app.models.schemas import ConversationMode


def test_a_stranger_cannot_open_my_session(api, seed, live_session):
    session = live_session(seed.doctor["id"], mode=ConversationMode.COMMERCIAL)
    token = seed.headers["delegate"]["Authorization"].split(" ", 1)[1]

    with pytest.raises(WebSocketDisconnect) as rejected:
        with api.websocket_connect(f"/api/v1/conversation/ws/{session.id}?token={token}") as socket:
            socket.receive_text()

    assert rejected.value.code == 4403


def test_an_unknown_token_is_refused(api, seed, live_session):
    session = live_session(seed.doctor["id"])

    with pytest.raises(WebSocketDisconnect) as rejected:
        with api.websocket_connect(f"/api/v1/conversation/ws/{session.id}?token=not-a-token") as socket:
            socket.receive_text()

    assert rejected.value.code == 4401


def test_the_owner_can_open_their_session(api, seed, live_session):
    session = live_session(seed.doctor["id"])
    token = seed.headers["doctor"]["Authorization"].split(" ", 1)[1]

    with api.websocket_connect(f"/api/v1/conversation/ws/{session.id}?token={token}") as socket:
        # No greeting frame is expected here: the handshake accepted, which is
        # what this test is about. A ping is answered, proving it is live.
        socket.send_text('{"type": "ping"}')
        assert socket.receive_json() == {"type": "pong"}
