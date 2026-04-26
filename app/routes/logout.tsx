import {redirect} from 'react-router';
import type {Route} from './+types/logout';
import {buildLogoutHeaders} from '~/lib/auth-cookie';

export async function action(_: Route.ActionArgs) {
  return new Response(null, {status: 302, headers: buildLogoutHeaders()});
}

export async function loader() {
  return redirect('/login');
}
