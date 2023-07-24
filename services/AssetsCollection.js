import { UndefinedCollectionException, UndefinedIdException } from "../exceptions/AssetsCollectionExceptions";
import { dataCollectionMutation } from "./store";

export class AssetsCollection {

    /**
     * Initialise le controller
     * 
     * @param {object} app Instance de l'application VueJS
     * @param {object} options 
     * - @param {string} assetName Clé de la collection cible dans le state du store
     * - @param {string} apiRoute Nom de la route d'API à contacter pour récupérer une ressource
     * - @param {string} updateAction Nom de l'action à déclencher dans le store pour mettre à jour la collection
     * - @param {string} resetAction Nom de l'action à déclencher dans le store pour vider la collection
     * - @param {object} requestPayload Paramètres passés en GET pour chaque requêtes
     * - @param {string} idParam Paramètre du payload transportant l'IDs ou la liste d'ID en cas de requête de liste
     * - @param {string} namespace Précise le namespace du store à utiliser pour le state
     * - @param {object} axiosConfig Configuration axios envoyée lors des requêtes à l'API
     * - @param {string} pendingKey Clé stockant la mise en attente des requête dans le state. Cette clé doit se trouver dans state.pending
     */
    constructor(app, options) {
        /**
         * L'ensemble de l'instance de l'application VueJS
         */
        this.app = app;

        /**
         * Raccourcis vers l'instance du store VueX
         */
        this.store = app.$store;

        /**
         * Raccourcis vers l'instance de l'API
         */
        this.api = app.$app.api;

        /**
         * Clé de la collection cible dans le store
         */
        this.assetName = options.assetName;

        /**
         * Route d'API à contacter pour récupérer les informations
         */
        this.apiRoute = options.apiRoute;

        /**
         * Nom de l'action à déclencher dans le store pour mettre à jour la collection
         */
        this.updateAction = options.updateAction;

        /**
         * Nom de l'action à déclencher dans le store pour mettre à jour la collection
         */
        this.resetAction = options.resetAction;

        /**
         * Paramètres passés en GET pour chaque requête à l'API
         */
        this.requestPayload = options.requestPayload;

        /**
         * Paramètre du payload transportant l'ID ou la liste d'IDs en cas de requête de liste
         */
        this.idParam = options.idParam ?? 'id';

        /**
         * Précise le namespace du store à utiliser pour le state
         */
        this.namespace = options.namespace ?? null;

        if (typeof this.getCollection() === 'undefined') {
            throw new UndefinedCollectionException(this.assetName);
        }

        this.notFoundIds = [];

        /**
         * Configuration passée à Axios à chaque requête
         */
        this.axiosConfig = typeof options.axiosConfig !== 'undefined' ? options.axiosConfig : {};

        /**
         * Clé de state.pending contenant la mise en attente de la requête.
         */
        this.pendingKey = typeof options.pendingKey !== 'undefined' ? options.pendingKey : this.assetName;
    }

    /**
     * Intialise le raccourcis vers le contenu de la collection
     */
    getCollection() {
        return this.namespace ? this.store.state[this.namespace][this.assetName] : this.store.state[this.assetName];
    }

    /**
     * Récupère une ressource avec son ID.
     * 
     * @param {number} id ID de la ressource à trouver
     * @param {object} options 
     * - @param {bool} bypass_not_found_cache (Défaut : false). Ignorer le cache pour les valeurs non-trouvées
     */
    getById(id, options) {

        options = typeof options === 'undefined' ? {} : options;

        return new Promise((resolve) => {
            if (!id) {
                throw new UndefinedIdException();
            }

            const found = this.getCollection().find(e => e.id == id);

            if (found) {
                this.removeFromNotFound(found.id);
                resolve(found);
            }

            else {
                if (this.isNotFound(id) && !options.bypass_not_found_cache) {
                    this.warnNotFound(id);
                    resolve(null);
                }
                else {
                    return this.getFromApi(this.apiRoute+'/'+id, this.requestPayload)
                    .then(data => {
                        if (data) {
                            this.removeFromNotFound(id);
                            this.updateCollection([data]);
                        }
                        else {
                            this.warnNotFound(id);
                            this.addToNotFound(id);
                        }
                        resolve(data);
                    });
                }
            }
        })
    }

    /**
     * Log un message d'erreur dans la console en cas de ressource par ID non trouvée.
     * 
     * @param {number} id           ID de la ressource non trouvée.
     */
    warnNotFound(id) {
        console.warn(`Aucune ressource trouvée sur l'API ${this.apiRoute}/${id}`);
    }

    /**
     * Retire un ID des éléments non-trouvés
     * 
     * @param {number} id ID de l'élément à retirer des non-trouvés
     */
    removeFromNotFound(id) {
        const index = this.notFoundIds.findIndex(e => e == id);

        if (index !== -1) {
            this.notFoundIds.splice(index, 1);
        }
    }

    /**
     * Ajoute un ID dans les éléments non-trouvés
     * 
     * @param {number} id ID de l'élément à ajouter dans les non-trouvés
     */
    addToNotFound(id) {
        const index = this.notFoundIds.findIndex(e => e == id);

        if (index === -1) {
            this.notFoundIds.push(id);
        }
    }

    /**
     * Teste si un élément se trouve dans les non-trouvés
     * 
     * @param {number} id ID de l'élément à tester
     * 
     * @return {bool}
     */
    isNotFound(id) {
        const index = this.notFoundIds.findIndex(e => e == id);
        return index !== -1;
    }

    /**
     * Retourne la liste des ID de ressources qui ne sont pas encore chargées depuis l'API
     * 
     * @param {array} ids Liste des ID à tester
     * 
     * @returns {array}
     */
    listNotLoadedIds(ids) {
        let notLoadedIds = [];
        let checkedIds = [];

        ids.forEach(id => {
            if (!this.isLoaded(id) && !checkedIds.find(e => e == id) && id) {
                notLoadedIds.push(id);
            }
            checkedIds.push(id);
        });

        return notLoadedIds;
    }

    /**
     * Contrôle si l'ID d'une ressource a déjà été chargée depuis l'API
     * 
     * @param {number} id L'ID de la ressource à tester
     * 
     * @returns {bool}
     */
    isLoaded(id) {
        const found = this.getCollection().find(e => e.id == id);
        return found || this.isNotFound(id) ? true : false;
    }

    /**
     * Charge les informations depuis l'API
     * 
     * @param {object} payload Un payload additionnel à envoyer lors de la requête
     * 
     * @return {Promise<array>}
     */
    async load(payload) {

        this.setPending(true);

        payload = typeof payload === 'undefined' ? {} : payload;

        let pl = this.requestPayload ?? {};
        pl = payload ? {...pl, ...payload} : pl;

        const idParam = this.idParam;

        if (pl[idParam]) {
            let ids = pl[idParam].split(",");
            pl[idParam] = this.listNotLoadedIds(ids).join(',');
            
            if (!pl[idParam]) return;
        }

        try {
            const data = await this.getFromApi(this.apiRoute, pl);
    
            if (payload[idParam]) {
                const ids = payload[idParam].split(",");
                this.checkForNotFound(ids, data);
            }
    
            this.updateCollection(data);
        
            return data;
        }
        finally {
            this.setPending(false);
        }
    }

    /**
     * Modifie l'état de la requête
     * 
     * @param {bool} val Valeur à affecter au pending
     */
    setPending(val) {
        if (typeof this.store.state?.pending[this.pendingKey] !== 'undefined') {
            this.store.state.pending[this.pendingKey] = val;
        }
    }

    /**
     * Met à jour les ids non trouvés depuis une liste d'ids et de résultats
     * 
     * @param {array} requestIds Liste des ids passés lors de la requête
     * @param {array} responseData Collection retournée par la requête
     */
    checkForNotFound(requestIds, responseData) {
        requestIds.forEach(id => {
            const found = responseData.find(e => e.id === id);

            if (found) {
                this.removeFromNotFound(id);
            }
            else {
                this.addToNotFound(id);
            }
        });
    }

    /**
     * Récupère des informations depuis l'API
     * 
     * @param {string} route Nom de la route d'API à contacter
     * @param {object} payload Payload à passer sur la requête
     * @param {object} axiosConfig Cette configuration écrase la configuration générale
     * 
     * @returns {Promise}
     */
    async getFromApi(route, payload, axiosConfig) {
        axiosConfig = typeof axiosConfig !== 'undefined' ? axiosConfig : this.axiosConfig;
        const data = await this.api.get(route, payload, axiosConfig);
        return data;
    }


    /**
     * Ré-initialise la collection sur le store et sur le controller
     */
    reset() {
        this.notFoundIds = [];
        if (this.resetAction) {
            this.store.dispatch(this.resetAction);
        }
        else {
            dataCollectionMutation(this.store.state, {
                assetName: this.assetName,
                action: "replace",
                collection: []
            });
        }
    }

    
    /**
     * Met à jour des données sur le store
     * 
     * @param {array} collection La nouvelle collection à intégrer au store
     */
    updateCollection(collection) {
        if (this.updateAction) {
            this.store.dispatch(this.updateAction, collection);
        }
        else {
            dataCollectionMutation(this.store.state, {
                assetName: this.assetName,
                action: "refresh",
                collection
            });
        }
    }
}