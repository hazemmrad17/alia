import type { Metadata } from 'next'
import ContactsAppView from '@/views/ala/shared/contacts-app'

export const metadata: Metadata = {
  title: 'Contacts | ALIA Avatar',
  description: 'Contact directory — doctors for delegates, VITAL delegates for doctors.'
}

const ContactsPage = () => {
  return <ContactsAppView />
}

export default ContactsPage