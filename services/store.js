/**
 * Met à jour une collection de données dans le store
 * 
 * @param {object} state Le state de VueX
 * @param {object} collectionOptions Options de la collection à faire mutter
 * - assetName  	Nom de la clé au niveau du state
 * - collection 	Informations à stocker dans le state
 * - action     	'refresh' (par défaut), 'replace', 'remove'
 */
export function dataCollectionMutation(state, collectionOptions) {
    const assetName = collectionOptions.assetName;
    const collection = collectionOptions.collection;
    const action = typeof collectionOptions.action === 'undefined' ? 'refresh' : collectionOptions.action;

    if (action === 'replace') {
        state[assetName] = collection;
    }
    else {
        collection.forEach(data => {
            if (action === 'remove') {
                const index = state[assetName].find(e => e.id == data.id);

                if (index !== -1) {
                    state[assetName].splice(index, 1);
                }
            }
            // Dans tous les autres cas, on considère qu'on rafraichie les données existantes
            else {
                const found = state[assetName].find(e => e.id == data.id);

                if (found) {
                    for (const key in data) {
                        found[key] = data[key];
                    }
                }
                else {
                    state[assetName].push(data);
                }
            }
        });
    }
}