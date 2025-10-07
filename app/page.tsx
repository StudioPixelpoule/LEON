/**
 * Redirection vers /films
 */

import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/films')
}
