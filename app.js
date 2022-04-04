import axios from "axios";
import * as bootstrap from "bootstrap";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, getIdToken } from "firebase/auth";
import { StructureUnavailableError, AuthProviderUnreferencedError } from "./errors";


/**
 * Classe de pré-configuration des applications.
 */
export default class App {

    /**
     * @param {Object} cfg
     * - name {String}              Le nom de l'application en snakecase. Ce nom est utilisé dans l'URL pour déterminer si l'action
     *                              demandée doit être lancée sur l'application (ex #!document/2/informations . Ici, document est le nom
     *                              de l'appli )
     * - cfg {Object}               La configuration par défaut si les clés ne sont pas renseignées au niveau de l'élément HTML
     * - api {String}               L'URL de l'API racine. Ex /api/document (sans slash à la fin de la ligne)
     * - datetime_fields {Array}    Liste des champs datetime qui seront analysées dans les requête. Cela automatise la convertion des
     *                              champs datetime transmis par les navigateurs vers les champs DATETIME sql (2021-10-03T12:00:00 vers
     *                              2021-10-03 12:00:00).
     *                              Default : ['dc', 'dm']
     * - events {Object}            Fonction appelées à l'issues d'une opération sur l'instance VueJS ou les éléments chargés. Les fonction prennent
     *                              en paramètre l'instance VueJS
     * - events.openedElement.beforeOpen(this)            Avant l'ouverture d'un élément
     * - events.openedElement.opened(this)                Après le chargement d'un élément avec un status OK
     * - events.openedElement.openedExtended(this)        Après le chargement d'un élément et de sa hiérarchie avec un status OK
     * - events.openedElement.beforeDelete(this)          Avant la suppression d'un élément
     * - events.openedElement.deleted(this)               Une fois un élément supprimé avec un status OK
     * - events.openedElement.beforeRecord(this)          Avant l'enregistrement d'un élément
     * - events.openedElement.recoreded(this)             Une fois une élément enregistré avec un status OK
     *
     * - events.list.before(this)                         Avant une requête de liste
     * - events.list.success(this)                        Une fois une requête de liste passée avec le status OK
     * - events.list.error(this)                          Une fois une requête de liste passée avec une erreur
     * - events.list.done(this)                           Une fois une requête de liste passée, quelque soit le code d'erreur
     */
    constructor(cfg) {
        this.api = cfg.api;
        this.name = cfg.name;
        this.cfg = cfg.cfg;
        this.firebase_user = null;
        this.local_user = null;
        this.active_structure_id = null;

        this.ax = axios.create({
            baseURL: this.api.baseURL
        });

        this.firebaseApp = initializeApp(cfg.firebaseConfig);

        this.events = cfg.events;

        if (typeof this.events === 'undefined') {
            this.events = {};
        }
        if (typeof this.events.openedElement === 'undefined') {
            this.events.openedElement = {};
        }
        if (typeof this.events.list === 'undefined') {
            this.events.list = {};
        }
    
        if (typeof this.datetime_fields === 'undefined') {
            this.datetime_fields = ['dc', 'dm'];
        }

    }

    /**
     * Ferme l'ensemble des modals ouverts.
     * On concidère un modal tout élément contenant la classe .modal
     */
    closeAllModals() {
        let modals = document.querySelectorAll('.modal');
        modals.forEach((modal) => {
            let btModal = new bootstrap.Modal(modal);
            btModal.hide();
        });
    }

    /**
     * Ferme tous les éléments ouvert. Contrôle l'enregistrement, affiche une demande de confirmation
     * si l'élément ouvert n'est pas enregistré.
     * @param {Object} vm               Instance vueJS
     */
    closeElement(vm) {
        this.closeAllModals();
        vm.$store.dispatch('closeElement');
    }

    /**
     * Crée une requête pour lister les éléments de l'application
     * @param {Object} vm               Instance vueJS
     * @param {Object} query            Paramètres de la requête sous la forme key : value
     * 
     * @returns {Promise}
     */
    listElements(vm, query) {

        if ('before' in this.events.list) {
            this.events.list.before(this);
        }

        vm.pending.elements = true;

        return this.apiGet('/' + this.api.elements + '/GET/list', query)
        .then((data) => {
            if ('success' in this.events.list) {
                this.events.list.success(this);
            }
            return data;
        })
        .catch((error) => { 
            if ('error' in this.events.list) {
                this.events.list.error(this);
            }

            throw Error(error)
        });
    }

    /**
     * Charge les sous-objets d'un élément
     * @param {Object} vm Le composant ou l'instance vuejs
     * @param {Object} element L'élément comportant un ID
     * @returns {Object}
     */
    loadExtended(vm, element) {
        vm.pending.extended = true;

        return this.apiGet('/' + this.api.elements + '/GET/' + element.id + '?api_hierarchy=1')
        .then((data) => {
            return data;
        })
        .catch((error) => {
            throw Error(error);
        });
    }

    /**
     * Envoie une demande de suppression de l'élément ouvert à l'API
     * @param {Object} vm               Instance vueJS
     */
    deleteElement(vm) {
        if (confirm('Souhaitez vous supprimer ?')) {
            vm.pending.elements = true;

            if ('beforeDelete' in this.events.openedElement) {
                this.events.openedElement.beforeDelete(this);
            }

            let id = vm.$store.state.openedElement.id;

            this.ax.post('/' + this.api.elements + '/DELETE/' + id)
                .then((resp) => {
                    let apiResp = resp.data;

                    if (apiResp.status === 'OK') {
                        vm.$store.dispatch('refreshElements', {
                            mode: 'remove',
                            elements: apiResp.data
                        });

                        if ('deleted' in this.events.openedElement) {
                            this.events.openedElement.deleted(this);
                        }
                    }
                    else {
                        this.catchError(apiResp);
                    }
                })
                .catch(this.catchError);
        }
    }

    /**
     * Enregistre des modifications sur le serveur et gère les opérations de callback
     *
     * @param {Object} vm               Instance vueJS
     * @param {Object} query            La liste des modification sous la forme key: value
     * @param {Object} options          Un objet de paramétrage facultatif
     * - pending           String       Une clé de this.pending qui sera passée à true lors de l'opération
     * - id                Int          Si définit, l'ID sur lequel les données sont enregistrées. Dans le cas contraire, l'ID chargé.
     */
    record(vm, query, options) {

        if ('beforeRecord' in this.events.openedElement) {
            this.events.openedElement.beforeRecord(this);
        }

        if (typeof options === 'undefined') {
            options = {};
        }

        if (options.pending) {
            vm.pending[options.pending] = true;
        }

        let id;
        if (typeof options.id !== 'undefined') {
            id = options.id;
        }
        else {
            id = vm.$store.state.openedElement.id;
        }

        return this.apiPost('/' + this.api.elements + '/POST/' + id + '?api_hierarchy=1', query)
        .then((data) => {
            if (options.pending) {
                self.pending[options.pending] = false;
            }

            if ('recorded' in this.events.openedElement) {
                this.events.openedElement.recorded(this);
            }

            return data;
        })
        .catch((error) => {
            throw Error(error);
        });
    }

    /**
     * Vérifie si l'élément passé est actif
     * 
     * @param {Object} vm L'instance VueJS
     * @param {Object} element L'élément à vérifier
     * 
     * @returns {Boolean}
     */
    isActive(vm, element) {
        if (vm.$store.state.openedElement) {
            if (element.id == vm.$store.state.openedElement.id) {
                return true;
            }
        }
        return false;
    }

    /**
     * Traite les retours d'erreur via un paramètre unique
     * @param {Mixed} error Le retour d'erreur. Si c'est un objet et qu'une clé message existe, le message est affiché en alert
     */
    catchError(error, options) {

        options = typeof options === 'undefined' ? {} : options;

        let message = "Une erreur est survenue mais le serveur n'a renvoyé aucune information. Les données techniques ont été retournées dans la console.";

        if ('message' in error) {
            message = error.message;
        }
        else {
            if (typeof error === 'string') {
                message = error;
            }
        }

        console.error(message, error);

        if (options.mode === 'message') {
            return message;
        }
        else {
            window.alert(message);
        }
    }

    /**
     * Ouvre une session avec l'API via un access token
     * @param {Object} vm Instance VueJS
     * @param {String} login Nom d'utilisateur
     * @param {String} password Mot de passe
     * 
     * @return {Promise}
     */
    login(vm, login, password) {

        let  auth;
        
        try {
            auth = getAuth(this.firebaseApp);
        } catch (error) {
            throw Error(error);
        }

        return signInWithEmailAndPassword(auth, login, password)
        .then((userCredential) => {
            const user = userCredential.user;
            this.firebase_user = user;
            return this.authToApi();
        })
        .then((resp) => {
            return resp;
        })
        .catch((error) => {
            throw Error(error);
        });
    }

    
    /**
     * Ouvre une session via un prestataire externe
     * 
     * @param {String} authProvider Le fournisseur de service de connexion (ex : google)
     * 
     * @returns {Promise}
     */
    loginProvider(authProvider) {
        let auth = getAuth(this.firebaseApp);

        if (authProvider === 'google') {

            const provider = new GoogleAuthProvider();

            return signInWithPopup(auth, provider)
            .then((result) => {
                // This gives you a Google Access Token. You can use it to access the Google API.
                const credential = GoogleAuthProvider.credentialFromResult(result);
                console.log(credential);
                // ...
            }).catch((error) => {
                throw Error(error);
            });
        }

        else {
            throw new AuthProviderUnreferencedError(authProvider);
        }
    }


    /**
     * Envoie une requête en GET à l'API via Axios
     * 
     * @param {String} apiUrl Url de l'API à appeler
     * @param {Object} params Liste des paramètres à passer via la méthode get
     * 
     * @returns {Promise}
     */
    apiGet(apiUrl, params) {
        let auth = getAuth();

        return getIdToken(auth.currentUser)
        .then(() => {
            params = typeof params === 'undefined' ? {} : params;

            return this.ax.get(apiUrl, {
                params
            })
            .then((resp) => {
                if (resp.data.status === 'OK') {
                    return resp.data.data;
                }
                else {
                    console.error(resp);
                    throw new Error(`Erreur dans l'échange avec l'API : ${resp.data.message}`);
                }
            })
            .catch((error) => {
                throw Error(error);
            });
        })
        .catch((error) => {
            throw Error(error);
        });
    }


    /**
     * Envoie une requête en POST à l'API via Axios
     * 
     * @param {String} apiUrl Url de l'API à appeler
     * @param {Object} params Liste des paramètres à passer via la méthode POST
     * 
     * @returns {Promise}
     */
    apiPost(apiUrl, params) {
        let auth = getAuth();

        return getIdToken(auth.currentUser)
        .then(() => {
            let data = new FormData();
            for (let key in params) {
                data.append(key, params[key]);
            }

            return this.ax.post(apiUrl, data).then((resp) => {
                if (resp.data.status === 'OK') {
                    return resp.data.data;
                }
                else {
                    console.error(resp);
                    throw new Error(`Erreur dans l'échange avec l'API : ${resp.data.message}`);
                }
            })
            .catch((error) => {
                throw Error(error);
            });
        })
        .catch((error) => {
            throw Error (error);
        })
    }


    /**
     * Authentifie l'utilisateur au niveau de l'API. Pour s'authentifier, l'utilisateur devra 
     * au préalable être authentifié auprès de Firebase. L'idToken de firbase servira de point de 
     * contrôle. L'authentification à l'API retourne un nouveau token qui servira à suivre les 
     * futures requêtes.
     * 
     * Une fois authentifié auprès de l'API, on vérifie la structure à activer :
     * - Soit il y a une primary_structure, dans ce cas c'est elle qui sert de structure active à la connexion
     * - Dans le cas contraire, c'est la première structure du tableau des structures qui sert de structure par défaut
     * Le token d'accès et la structure sont stockés dans le header de toutes les futures requêtes.
     * 
     * @returns {Promise} Si la promesse est résolut, retourne un objet contenant un token, le login 
     * et les structures attachées
     */
    authToApi() {
        let auth = getAuth();

        return getIdToken(auth.currentUser)
        .then((idtk) => {
            return new Promise((resolve, reject) => {
                let data = new FormData();
                data.append('idToken', idtk);

                this.ax.post('/auth?firebase=1', data)
                .then((resp) => {
                    let user = resp.data.data;

                    // Structure active à la connexion
                    // - primary_structure (par défaut)
                    // - la première structure renvoyé le cas échéant
                    this.active_structure_id = user.login.primary_structure;
                    if (!this.active_structure_id && user.structures.length) {
                        this.active_structure_id = user.structures[0].id;
                    }
                    
                    if (!this.active_structure_id) {
                        console.warn("Aucune structure active. L'API risque de ne retourner aucune valeur.");
                    }

                    this.local_user = user;

                    this.ax.defaults.headers.common['Authorization'] = user.token.jwt;
                    this.ax.defaults.headers.common['Structure'] = this.active_structure_id;

                    resolve(user);
                })
                .catch((resp) => {
                    reject(resp);
                });
            });
        })
        .catch((error) => {
            throw Error(error);
        });
    }

    /**
     * Active une structure. Modifie l'ID de la structure active dans l'application et 
     * change l'information stockée dans le header de chaque requête.
     * @param {Integer} id L'ID de la structure à activer
     */
    setStructure(id) {
        let found = this.local_user.structures.find(e => e.id == id);

        if (found) {
            this.active_structure_id = id;
            this.ax.defaults.headers.common['Structure'] = this.active_structure_id;
        }

        else {
            throw new StructureUnavailableError(id);
        }
    }


    /**
     * Duplique l'élément ouvert dans un élément temporaire du store
     * @param {Object} vm L'instance vueJS contenant une clé $store
     */
    makeTmpElement(vm) {
        let element = vm.$store.state.openedElement;

        if (element) {
            let tmp = {};
            for (let key in element) {
                if (typeof element[key] !== 'object') {
                    tmp[key] = element[key];
                }
            }

            vm.$store.commit('tmpElement', tmp);
        }
    }

    /**
     * Vide la copie temporaire de l'élément
     * @param {Object} vm L'instance vueJS contenant une clé $store
     */
    clearTmpElement(vm) {
        vm.$store.commit('tmpElement', null);
    }
}