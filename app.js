import axios from "axios";
import * as bootstrap from "bootstrap";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, getIdToken, signOut, onAuthStateChanged, OAuthProvider } from "firebase/auth";
import { StructureUnavailableError, AuthProviderUnreferencedError, LicenceNotFoundError, LicenceServerUndefinedError } from "./errors";
import {Licence} from "./models/Licence";
import { ApiController } from "./controllers/ApiController";
import { PasServer } from "./models/PasServer";


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
        this.apiConfig = cfg.api;
        this.name = cfg.name;
        this.cfg = cfg.cfg;
        this.firebase_user = null;
        this.local_user = null;
        this.active_structure_id = null;
        this.refreshAuthTimer = null;
        this.env = cfg.env;
        this.firebaseConfig = cfg.firebaseConfig;
        this.app_key = null;
        this.domains = cfg.domains;
        this.licences = null;
        this.licence = null;
        this.authInited = false;
        this.api = new ApiController();

        this.initializeAppKey();
        this.initializeFirebase();
        this.initializePas();

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

    initializeAppKey() {
        if (this.env in this.domains) {
            this.app_key = this.name+'@'+this.domains[this.env];
        }
    }

    /**
     * On initialise une application firebase en fonction des informations stockées dans le fichier de configuration.
     * Le fichier de configuration détient une clé "firebaseConfig" qui peut contenir :
     * - Soit la configuration directe de firebase
     * - Soit plusieurs clés ("prod", "dev") qui contiennent des configurations firebase. La configuration chargée
     *   dépend de la valeur de cfg.env qui doit correspondre à l'une de ces clés
     */
    initializeFirebase() {
        if (this.firebaseConfig) {

            let firebaseCfg;

            // Injection directe
            if (this.firebaseConfig.apiKey) {
                firebaseCfg = this.firebaseConfig;
            }
            // Injection via la variable d'environnement
            if (this.env in this.firebaseConfig) {
                firebaseCfg = this.firebaseConfig[this.env];
            }

            this.firebaseApp = initializeApp(firebaseCfg);
        }
    }

    /**
     * Hydratation des informations concernant l'accès au Pebble Authenticator Server (PAS)
     */
    initializePas() {
        let api = this.apiConfig[this.env];
        if (api) {
            for (const key in api) {
                this.apiConfig[key] = api[key];
            }
        }

        this.api.auth_server = new PasServer(this.apiConfig);
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

        return this.apiGet('/' + this.apiConfig.elements + '/GET/list', query)
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

        return this.apiGet('/' + this.apiConfig.elements + '/GET/' + element.id + '?api_hierarchy=1')
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

            this.apiPost('/' + this.apiConfig.elements + '/DELETE/' + id)
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

        return this.apiPost('/' + this.apiConfig.elements + '/POST/' + id + '?api_hierarchy=1', query)
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
     * @param {Object} options
     * - mode               Défaut null / message (return le message)
     */
    catchError(error, options) {

        options = typeof options === 'undefined' ? {} : options;

        let message = "Une erreur est survenue mais le serveur n'a renvoyé aucune information. Les données techniques ont été retournées dans la console.";

        if ('message' in error) {
            message = error.message;
        }
        else if ('statusText' in error) {
            let apiMessage;
            if (error.data) {
                if (error.data.message) {
                    apiMessage = `${error.data.message} (${error.status} ${error.statusText})`;
                }
            }
            if (!apiMessage) {
                message = `${error.status} ${error.statusText}`;
            }
            else {
                message = apiMessage;
            }
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
     * Ouvre une session avec l'API via un access token.
     * 
     * @param {Object} vm Instance VueJS
     * @param {String} login Nom d'utilisateur
     * @param {String} password Mot de passe
     * 
     * @return {Promise}
     */
    login(vm, login, password) {

        let  auth;

        this.clearAuth();
        
        try {
            auth = getAuth(this.firebaseApp);
        } catch (error) {
            throw Error(error);
        }

        return signInWithEmailAndPassword(auth, login, password);
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

            return signInWithPopup(auth, provider);
        }

        else if (authProvider === 'microsoft') {
            const provider = new OAuthProvider('microsoft.com');

            provider.setCustomParameters({
                // Optional "tenant" parameter in case you are using an Azure AD tenant.
                // eg. '8eaef023-2b34-4da1-9baa-8bc8c9d6a490' or 'contoso.onmicrosoft.com'
                // or "common" for tenant-independent tokens.
                // The default value is "common".
                tenant: '714e739c-a0f1-4eca-922c-cfeaedb0cc47'
            });

            return signInWithPopup(auth, provider);
        }

        else {
            throw new AuthProviderUnreferencedError(authProvider);
        }
    }


    /**
     * Envoie une requête en GET à l'API via Axios
     * 
     * @param {string} route Url de l'API à appeler
     * @param {object} params Liste des paramètres à passer via la méthode get
     * 
     * @returns {Promise}
     */
    apiGet(route, params) {
        return this.api.get(route, params);
    }


    /**
     * Envoie une requête en POST à l'API via Axios
     * 
     * @param {string} route Url de l'API à appeler
     * @param {object} params Liste des paramètres à passer via la méthode POST
     * 
     * @returns {Promise}
     */
    apiPost(route, params) {
        return this.api.post(route, params);
    }

    /**
     * Traite les erreurs d'authentification :
     * - Récupère le message
     * - Envoie un événement authError
     * - Lève une exception
     * 
     * @param {object} error Un objet contenant un message d'erreur ou le message directement
     */
    authError(error) {
        let message;
        if(error.response) {
            message = this.catchError(error.response, {
                mode: 'message'
            });
        }
        else {
            message = error.message ?? error;
        }
        
        this.dispatchEvent('authError', message);
        throw new Error(message);
    }

    /**
     * Injecte les données du local_user au niveau de l'application et ajoute les headers permettant 
     * l'authentification au serveur API sur la configuration Axios.
     * 
     * @param {LocalUser} user 
     */
    initializeLocalUser(user) {
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

        this.api.setStructure(this.active_structure_id);

        this.dispatchEvent('authChanged', user);
        this.dispatchEvent('structureChanged', this.active_structure_id);
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
            this.api.setStructure(this.active_structure_id);
            this.dispatchEvent('structureChanged', found.id);
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

    /**
     * Vide les informations d'authentification :
     * - Les informations de licence
     * - Les informations sur l'utilisateur firebase
     */
    clearAuth() {
        this.dispatchEvent('beforeClearAuth');
        this.clearLicence();
        this.firebase_user = null;
        this.licences = null;
        this.dispatchEvent('authCleared');
    }

    /**
     * Vide les informations sur la licence en cours d'utilisation
     * - Les headers HTTP
     * - Les éléments temporairement stockés en session
     */
    clearLicence() {
        this.dispatchEvent('beforeClearLicence');

        this.api.clearSession();

        this.active_structure_id = null;
        this.local_user = null;
        this.licence = null;

        sessionStorage.removeItem('licence');

        this.dispatchEvent('licenceCleared');
    }

    /**
     * Ajoute un observeur d'événement sur les actions générales de l'application
     * @param {String} event L'événement à observer
     * @param {Function} fn La fonction de callback
     */
    addEventListener(event, fn) {
        if (typeof this.events[event] === 'undefined') {
            this.events[event] = [];
        }

        this.events[event].push(fn);
    }

    /**
     * Exécute les fonctions de callback liées à un événement
     * @param {String} event Événement à exécuter
     * @param {Mixed} payload Informations communiquées par l'événement
     */
    dispatchEvent(event, payload) {
        if (typeof this.events[event] === 'object') {
            this.events[event].forEach(fn => fn(payload));
        }
    }

    /**
     * Vide la liste des fonctions liées à un événement.
     * @param {String} event Événement à vider
     */
    clearEventListener(event) {
        this.events[event] = [];
    }

    /**
     * Ferme la session firebase et vide l'authentification
     * @return {Promise}
     */
    async logout() {
        let auth = getAuth();
        await signOut(auth);
        this.dispatchEvent('logout');
    }

    /**
     * Lance les processus de contrôle de l'authentification.
     * Étape du contrôle de l'authentification :
     * 1. Récupération de l'utilisateur actif
     * 2. Si utilisateur actif, récupération des licences
     *              - depuis le sessionStorage si elle existe en session
     *              - depuis le serveur firestore dans le cas contraire
     * 3. Si une seule licence, connexion à l'API, si plusieurs licences, demande de la licence à connecter
     * 4. La licence utilisée est stockée dans le sessionStorage
     * 
     * @emit licencesRetrieved {Array} licences
     * @emit authInited {Object} user
     * @emit authError {String} message
     */
    checkAuth() {
        let auth = getAuth();

        onAuthStateChanged(auth, (user) => {
            if (user) {
                if (!this.authInited) this.dispatchEvent('authInitializing', user);

                this.firebase_user = user;
                this.autoSelectLicences()
                .then((licences) => {
                    if (licences.length <= 0) {
                        throw new LicenceNotFoundError();
                    }
                    else if (licences.length === 1) {
                        return this.toggleLicence(licences[0]);
                    }
                    else {
                        this.dispatchEvent('licencesRetrieved', licences);
                    }
                })
                .catch(e => this.dispatchEvent('authError', e.message))
                .finally(() => {
                    if (!this.authInited) {
                        this.authInited = true;
                        this.dispatchEvent('authInited', user);
                    }
                });
            }
            else {
                this.clearAuth();
                if (!this.authInited) {
                    this.authInited = true;
                    this.dispatchEvent('authInited', user);
                }
            }
        });
    }


    /**
     * Récupère les licences,
     * - soit depuis le sessionStorage
     * - soit depuis la base de données fireStore
     * @returns {Promise} la valeur retournée est un tableau de licences ou null
     */
    autoSelectLicences() {
        return new Promise((resolve) => {
            let licence = sessionStorage.getItem('licence');

            if (licence) {
                licence = JSON.parse(licence);
                resolve([licence]);
            }
            else {
                this.getLicences()
                .then((licences) => {
                    resolve(licences);
                })
            }
        });
    }

    /**
     * Récupère la liste des licences de l'utilisateur actif
     * - soit depuis les éléments pré chargées de l'application
     * - soit depuis Pebble Authenticator Server (PAS)
     * 
     * @returns {Promise}
     */
    getLicences() {
        return new Promise((resolve) => {
            if (this.licences) {
                resolve(this.licences);
            }
            else {
                let licences = [];

                let auth = getAuth();

                getIdToken(auth.currentUser)
                .then((idtk) => {

                    let server = new PasServer(this.apiConfig);

                    axios.get('licences', {
                        headers: {
                            "Authorization" : "Bearer "+idtk
                        },
                        params: {
                            app: this.app_key
                        },
                        baseURL: server.url
                    })
                    .then(resp => {
                        let servLicences = resp.data;
                        servLicences.forEach(licence => {
                            licence._id = licence.id;
                            licences.push(new Licence(licence))
                        })

                        this.licences = licences;

                        resolve(this.licences)
                    });
                });
            }
        })
    }

    /**
     * Change la licence active. Réinitialise axios sur la nouvelle URL.
     * 
     * @param {Object} licence      La nouvelle licence à charger
     * 
     * @emit beforeLicenceChange {Object} licence
     * @emit licenceChanged {Object} licence
     * 
     * @returns {Promise}
     */
    async toggleLicence(licence) {
        if (!licence.db) {
            throw new LicenceServerUndefinedError(licence);
        }

        let lic = new Licence(licence);

        this.dispatchEvent('beforeLicenceChange', lic);

        sessionStorage.setItem('licence', JSON.stringify(lic));
        this.licence = lic;
        this.api.licence = this.licence;
        try {
            let user = await this.api.auth();
            this.initializeLocalUser(user);
        }
        catch (error) {
            console.dir(error);
            this.authError(error);
        }

        this.dispatchEvent('licenceChanged', this.licence);

        return this.authToApi();
    }
}