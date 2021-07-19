
import {db} from './firebaseConfig'

// update firetable settings doc

db.doc(`_FIRETABLE_/settings`).update({updatedAt: new Date()}).then(() => {
  console.log('done')
})