export default async function authenticate(AUTH_SECRET_KEY, anchor, SigningKeypair) {
    // Finally, we authenticate using the wallet's SIGNING_KEY secret.
    const authKey = SigningKeypair.fromSecret(AUTH_SECRET_KEY);
    const sep10 = await anchor.sep10();
    const authToken = await sep10.authenticate({ accountKp: authKey });
    console.log("Auth Token: ", authToken);
    return authToken;
}