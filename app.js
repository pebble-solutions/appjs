import axios from "axios";
import * as bootstrap from "bootstrap";

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

        this.store = cfg.store;
        this.api = cfg.api;
        this.name = cfg.name;
        this.cfg = cfg.cfg;
        this.root = cfg.root;

        this.ax = axios.create({
            baseURL: this.api.baseURL
        });

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
     */
    closeElement() {
        this.closeAllModals();
        this.store.dispatch('closeElement');
    }

    /**
     * Crée une requête pour lister les éléments de l'application
     *
     * @param {Object} query            Paramètres de la requête sous la forme key : value
     * @param {String} mode             replace (default), update
     * @param {Function} callback       Fonction appelée après la recherche
     */
    listElements(query, mode, callback) {

        if ('before' in this.events.list) {
            this.events.list.before(this);
        }

        mode = typeof mode === 'undefined' ? 'update' : mode;

        this.root.pending.elements = true;

        this.ax.get('/' + this.api.elements + '/GET/list', {
            params: query
        })
            .then((resp) => {
                let apiResp = resp.data;

                if (apiResp.status === 'OK') {
                    if (mode == 'replace') {
                        this.store.dispatch('refreshElements', {
                            action: 'replace',
                            elements: apiResp.data
                        });
                    }
                    else {
                        this.store.dispatch('refreshElements', {
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

                this.root.pending.elements = false;
            })
            .catch(this.catchError);
    }

    /**
     * Envoie une demande de suppression de l'élément ouvert à l'API
     */
    deleteElement() {
        if (confirm('Souhaitez vous supprimer ?')) {
            this.root.pending.elements = true;

            if ('beforeDelete' in this.events.openedElement) {
                this.events.openedElement.beforeDelete(this);
            }

            let id = this.store.state.openedElement.id;

            this.ax.post('/' + this.api.elements + '/DELETE/' + id)
                .then((resp) => {
                    let apiResp = resp.data;

                    if (apiResp.status === 'OK') {
                        this.store.dispatch('refreshElements', {
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
     * @param {Object} query            La liste des modification sous la forme key: value
     * @param {Object} options          Un objet de paramétrage facultatif
     * - pending           String       Une clé de this.pending qui sera passée à true lors de l'opération
     * - callback          Function     Une fonction de callback qui prendra en premier argument la réponse du serveur et en deuxième l'objet vuejs
     * - update_data       Array/Bool   Une liste de clés à mettre à jour sur l'objet ou un booléen. Si c'est un booléen à True, alors l'ensemble des
     *                                  éléments reçus depuis le serveur seront mis à jour
     * - id                Int          Si définit, l'ID sur lequel les données sont enregistrées. Dans le cas contraire, l'ID chargé.
     */
    record(query, options) {

        if ('beforeRecord' in this.events.openedElement) {
            this.events.openedElement.beforeRecord(this);
        }

        if (typeof options === 'undefined') {
            options = {};
        }

        if (options.pending) {
            this.root.pending[options.pending] = true;
        }

        let id;
        if (typeof options.id !== 'undefined') {
            id = options.id;
        }
        else {
            id = this.store.openedElement.id;
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

                    this.store.dispatch('refreshOpened', data);
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
     * @param {Object} element L'élément à vérifier
     * @returns {Boolean}
     */
    isActive(element) {
        if (this.store.state.openedElement) {
            if (element.id == this.store.state.openedElement.id) {
                return true;
            }
        }
        return false;
    }

    /**
     * Traite les retours d'erreur via un paramètre unique
     * @param {Mixed} error Le retour d'erreur. Si c'est un objet et qu'une clé message existe, le message est affiché en alert
     */
    catchError(error) {
        if ('message' in error) {
            alert(error.message);
        }
        else {
            alert("Erreur d'exécution");
        }
        console.error(error);
    }
}