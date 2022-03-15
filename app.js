import axios from "axios";
import * as bootstrap from "bootstrap";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, getIdToken } from "firebase/auth";


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

        this.ax = axios.create({
            baseURL: this.api.baseURL
        });

        this.firebaseApp = initializeApp(cfg.firebaseConfig);

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
     * @param {String} mode             replace (default), update
     * @param {Function} callback       Fonction appelée après la recherche
     */
    listElements(vm, query, mode, callback) {

        if ('before' in this.events.list) {
            this.events.list.before(this);
        }

        mode = typeof mode === 'undefined' ? 'update' : mode;

        vm.pending.elements = true;

        this.ax.get('/' + this.api.elements + '/GET/list', {
            params: query
        })
            .then((resp) => {
                let apiResp = resp.data;

                if (apiResp.status === 'OK') {
                    if (mode == 'replace') {
                        vm.$store.dispatch('refreshElements', {
                            action: 'replace',
                            elements: apiResp.data
                        });
                    }
                    else {
                        vm.$store.dispatch('refreshElements', {
                            action: 'update',
                            elements: apiResp.data
                        });
                    }

                    if ('success' in this.events.list) {
                        this.events.list.success(this);
                    }
                }
                else {
                    this.catchError(apiResp);
                    if ('error' in this.events.list) {
                        this.events.list.error(this);
                    }
                }

                if ('done' in this.events.list) {
                    this.events.list.done(this);
                }

                if (typeof callback !== 'undefined') {
                    callback(this);
                }

                vm.pending.elements = false;
            })
            .catch(this.catchError);
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
     * - callback          Function     Une fonction de callback qui prendra en premier argument la réponse du serveur et en deuxième l'objet vuejs
     * - update_data       Array/Bool   Une liste de clés à mettre à jour sur l'objet ou un booléen. Si c'est un booléen à True, alors l'ensemble des
     *                                  éléments reçus depuis le serveur seront mis à jour
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
            id = vm.$store.openedElement.id;
        }

        this.ax.post('/' + this.api.elements + '/POST/' + id + '?api_hierarchy=1', {
            params: query
        })
        .then((resp) => {
            let apiResp = resp.data;

            if (apiResp.status === 'OK') {

                if (options.callback) {
                    options.callback(resp, this);
                }

                if (options.update_data) {
                    let data = {};

                    if (typeof options.update_data === 'object') {
                        options.update_data.forEach((key) => {
                            data[key] = apiResp.data[key];
                        });
                    }
                    else {
                        data = apiResp.data;
                    }

                    vm.$store.dispatch('refreshOpened', data);
                }

                if ('recorded' in this.events.openedElement) {
                    this.events.openedElement.recorded(this);
                }
            }

            // Erreur dans la réponse
            else {
                this.catchError(apiResp);
            }

            if (options.pending) {
                self.pending[options.pending] = false;
            }
        })
        .catch(this.catchError);
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
            console.error(error);
        }

        if (options.mode === 'message') {
            return message;
        }
        else {
            alert(message);
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

        let auth = getAuth();
        return signInWithEmailAndPassword(auth, login, password)
        .then((userCredential) => {
            const user = userCredential.user;
            this.user = user;

            console.log("Voici ce que j'ai reçu de Firebase", user);

            this.authWithFirebase()
            .then((resp) => {
                console.log("Voici ce que j'ai authentifié depuis le serveur de licence Pebble", resp);
            })
            .catch(this.catchError);
        })
        .catch(this.catchError);

        // let data = new FormData();
        // data.append('login', login);
        // data.append('password', password);

        // return new Promise((resolve, reject) => {
        //     this.ax.post('/auth?firebase_auth=1', data)
        //     .then((resp) => {
        //         console.log(resp);
        //         if (resp.data.status === 'OK') {
        //             resolve(resp);
        //         }
        //         else {
        //             reject(resp.data);
        //         }
        //     })
        //     .catch((resp) => {
        //         reject(resp);
        //     });
        // });
    }

    
    /**
     * Ouvre une session via un prestataire externe
     * @param {String} authProvider Le fournisseur de service de connexion (ex : google)
     * @returns {Promise}
     */
    loginProvider(authProvider) {
        let auth = getAuth();

        if (authProvider === 'google') {

            const provider = new GoogleAuthProvider();

            return signInWithPopup(auth, provider)
            .then((result) => {
                // This gives you a Google Access Token. You can use it to access the Google API.
                const credential = GoogleAuthProvider.credentialFromResult(result);
                console.log(credential);
                // ...
            }).catch(this.catchError);
        }

        else {
            throw new Error(`Le fournisseur de service ${authProvider} n'est pas référencé.`);
        }
    }

    /** 
     * Envoie une requête pour liste les structures autorisées pour l'utilisateur
     * @returns {Promise}
     */
    listStructures() {
        return new Promise((resolve, reject) => {
            this.ax.get('/structures/GET/list')
            .then((resp) => {
                if (resp.data.status === 'OK') {
                    resolve(resp);
                }
                else {
                    reject(resp.data);
                }
            })
            .catch((resp) => {
                reject(resp);
            });
        });
    }


    authWithFirebase() {
        let auth = getAuth();

        return getIdToken(auth.currentUser)
        .then((idtk) => {
            return new Promise((resolve, reject) => {
                let data = new FormData();
                data.append('idToken', idtk);

                this.ax.post('/auth?firebase=1', data)
                .then((resp) => {
                    resolve(resp);
                })
                .catch((resp) => {
                    reject(resp);
                });
            });
        })
        .catch(this.catchError);
    }
}