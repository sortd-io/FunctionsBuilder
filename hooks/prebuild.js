const admin = require("firebase-admin");

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

async function start() {
    const update = {
        ftBuildStatus: "BUILDING"
    }
    console.log(update)
    await db.doc("/_FIRETABLE_/settings").update(update)
}

start();