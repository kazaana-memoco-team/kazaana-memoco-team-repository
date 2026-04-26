import {redirect} from 'react-router';
import type {Route} from './+types/logout';
import {signOut} from '~/lib/auth';

export async function action({context}: Route.ActionArgs) {
  await signOut(context.session, context.env);
  const headers = new Headers();
  headers.set('Set-Cookie', await context.session.commit());
  return redirect('/login', {headers});
}

export async function loader() {
  return redirect('/login');
}
