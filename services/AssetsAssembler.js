export class AssetsAssembler {

    constructor(collection) {

        this.inputCollection = collection;
        this.collection = JSON.parse(JSON.stringify(collection));

    }

    /**
     * Join une collection d'assets sur la collection principale
     * 
     * @param {object} collection La collection à joindre sur la collection principale
     * @param {string} joinKey La colonne de jointure sur la collection principale
     * @param {string} on Clé sur laquelle on va joindre le résultat
     */
    async joinAsset(collection, joinKey, on) {

        let ids = this.inputCollection.map((e) => {
            if (e[joinKey]) {
                return e[joinKey];
            }
        });

        await collection.load({id: ids.join(',')});

        if (on) {
            this.collection.forEach(async (ressource) => {
                ressource[on] = [];
                let data = ressource[joinKey] ? await collection.getById(ressource[joinKey]) : null;
                ressource[on] = data;
            })
        }
    }

    /**
     * Retourne le résultat de l'assembler
     * 
     * @returns {object}
     */
    getResult() {
        return this.collection;
    }



}