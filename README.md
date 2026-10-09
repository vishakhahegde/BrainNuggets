hello

## Google sign-in setup

Students sign in with their Google account, and each account sees only its own saved lessons (`users/{uid}/...` in Firestore, enforced by `brain-nuggets/firestore.rules`).

One-time setup in the [Firebase console](https://console.firebase.google.com/project/brainnuggets-be6d9/authentication) for project `brainnuggets-be6d9`:

1. **Authentication → Sign-in method**: enable **Google** and pick a support email.
2. **Authentication → Settings → Authorized domains**: add every domain the app is served from. `localhost` is already there.

Anyone who used the app before this change was signed in anonymously. The first time they sign in with Google in the same browser, that anonymous account is upgraded, so their existing lessons carry over.
