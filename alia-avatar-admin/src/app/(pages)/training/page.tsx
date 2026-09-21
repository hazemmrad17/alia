import { redirect } from 'next/navigation'

// The training simulation lives on its own fullscreen route now
// (no navbar / sidebar). Keep /training working as a redirect.
const TrainingPage = () => {
  redirect('/simulation')
}

export default TrainingPage
