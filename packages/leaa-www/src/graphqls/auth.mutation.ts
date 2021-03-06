import gql from 'graphql-tag';

export const LOGIN_FOR_WWW = gql`
  mutation($user: AuthLoginInput!) {
    login(user: $user) {
      name
      email
      avatar {
        url
        urlAt2x
      }
      authToken
      authExpiresIn
    }
  }
`;

export const LOGIN_BY_TICKET_FOR_WWW = gql`
  mutation($ticket: String!) {
    loginByTicket(ticket: $ticket) {
      name
      email
      avatar {
        url
        urlAt2x
      }
      authToken
      authExpiresIn
    }
  }
`;

export const SIGNUP_FOR_WWW = gql`
  mutation($user: AuthSignupInput!, $uid: Int) {
    signup(user: $user, uid: $uid) {
      id
      name
      email
      authToken
      authExpiresIn
    }
  }
`;
