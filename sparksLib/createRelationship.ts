/**
 * -- EXAMPLE FIRETABLE SPARK --
 * The below spark will update the projects field on the requirements 
 * document every time the requirements field on the project document
 * is updated.
 * 
 * e.g. 
 * BEFORE: project[sourceID].requirements = ['a'], AFTER: project[sourceID].requirements = ['a', 'b']
 * BEFORE: requirements[b].projects = ['x'], AFTER: requirements[b].projects = ['x', sourceID]
 * 
 * -- END --
     {
        label: 'Create 1-way relationship: Projects -> Requirements',
        type: "createRelationship",
        shouldRun: ({change}) => change.before.get('requirements') !== change.after.get('requirements'),
        triggers: ['create', 'update', 'delete'],
        requiredFields: ["requirements"],
        sparkBody: {
            row: ({ row }) => row,
            sourceID: ({ref}) => ref.id,
            targetPath: 'requirements',
            targetField: 'projects',
            sourceField: 'requirements'
        }
    }
  
 */
export const dependencies = {
  "lodash.difference": "^4.5.0",
};

const significantDifference = (fieldsToSync, change) => {
  const beforeData = change.before.data();
  const afterData = change.after.data();
  return fieldsToSync.reduce((acc, field) => {
    if (JSON.stringify(beforeData[field]) !== JSON.stringify(afterData[field]))
      return true;
    else return acc;
  }, false);
};

/** splits array `arr` into chunks of max size `n` */
function chunkArr(arr, n) {
  if (n <= 0) throw new Error("n must be greater than 0");
  if(!arr ||arr.length === 0) return [[]]
  return Array
    .from({length: Math.ceil(arr.length/n)})
    .map((_, i) => arr.slice(n*i, n*(i+1)))
}

const batchedAddRemove = async (
  admin: any,
  targetPath: string,
  targetField: string,
  sourceID: string,
  sourceData: string[],
  add?: boolean
) => {
  const db = admin.firestore()
  const arrayUnion = (val:string) => admin.firestore.FieldValue.arrayUnion(val)
  const arrayRemove = (val:string) => admin.firestore.FieldValue.arrayRemove(val)
  const sourceDataInBatches = chunkArr(sourceData, 500) as string[][];
  const targetCollectionRef = (db as FirebaseFirestore.Firestore).collection(targetPath)
  await Promise.all(sourceDataInBatches.map(
    async idArray => {
      const batch = db.batch();
      idArray?.map(async id => {
        console.log(`
          ${add ? 'Adding' : 'Removing'} ${sourceID} ${add ? 'to' : 'from'} the 
          '${targetField}' field in the '${targetPath}' collection for the ${id} 
          document`
        )
        const docRef = targetCollectionRef.doc(id)
        batch.update(docRef, {[targetField]: add ? arrayUnion(sourceID) : arrayRemove(sourceID)});
      })
      await batch.commit();
    }
  ))
  return true
}


const createRelationship = async (data, sparkContext) => {

  const { row, targetPath, targetField, sourceField, sourceID } = data;
  const { triggerType, change } = sparkContext;
  const difference = require("lodash.difference")
  const sourceData = row[sourceField]
  if(!sourceData) {
    console.log('No data - bailing early')
    return true  
  }
  const { admin } = require("../firebaseConfig");

  switch (triggerType) {
    case "delete":
      try {
        console.log(`Items to remove: ${sourceData.length}`)
        await batchedAddRemove(
          admin,
          targetPath,
          targetField,
          sourceID,
          sourceData
        )
      }
      catch (error) {
        console.log(error);
      }
      break;
    case "update":
      if (
        significantDifference([sourceField, "_ft_forcedUpdateAt"], change)
      ) {
        try {
          const before = change.before.data()?.[sourceField]
          const after = change.after.data()?.[sourceField]
          const removed = difference(before, after)
          const added = difference(after, before)
          console.log(`Items to remove: ${removed.length}`)
          console.log(`Items to add: ${added.length}`)
          await batchedAddRemove(
            admin,
            targetPath,
            targetField,
            sourceID,
            removed
          )
          await batchedAddRemove(
            admin,
            targetPath,
            targetField,
            sourceID,
            added,
            true
          )
        } catch (error) {
          console.log(error);
        }
      }
      break;
    case "create":
      console.log(`Items to add: ${sourceData.length}`)
      await batchedAddRemove(
        admin,
        targetPath,
        targetField,
        sourceID,
        sourceData,
        true
      )
      break;
    default:
      break;
  }
  return true;
};

export default createRelationship;

