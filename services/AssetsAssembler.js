import { JoinKeyUndefinedException } from "../exceptions/AssetsExceptions";

export class AssetsAssembler {

    constructor(collection) {

        this.inputCollection = collection;
        this.collection = JSON.parse(JSON.stringify(collection));
        this.joinedCollections = {};

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

        let payload = {};
        payload[collection.idParam] = ids.join(',');

        if (payload[collection.idParam]) {
            await collection.load(payload);
        }

        if (on) {
            if (typeof this.joinedCollections[on] === 'undefined') {
                this.joinedCollections[on] = [];
            }

            this.collection.forEach(async (ressource) => {
                let data = ressource[joinKey] ? await collection.getById(ressource[joinKey]) : null;
                ressource[on] = data;

                this.joinedCollections[on].push(data);
            })
        }
    }

    /**
     * Retourne le résultat de l'assembler
     * 
     * @param {string} collectionKey
     * 
     * @returns {object}
     */
    getResult(collectionKey) {
        if (collectionKey) {
            if (typeof this.joinedCollections[collectionKey] === 'undefined') {
                throw new JoinKeyUndefinedException(collectionKey);
            }
            return this.joinedCollections[collectionKey];
        }
        return this.collection;
    }



}