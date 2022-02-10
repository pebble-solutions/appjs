function App(cfg) {

    this.store = cfg.store;
    this.api = cfg.api;
    this.ax = axios.create({
        baseURL: this.api.baseURL
    });

    /**
     * closeAllModals()
     * Ferme l'ensemble des modals ouverts.
     * On concidère un modal tout élément contenant la classe .modal
     */
    this.closeAllModals = function() {
        let modals = document.querySelectorAll('.modal');
        modals.forEach((modal) => {
            let btModal = new bootstrap.Modal(modal);
            btModal.hide();
      });
    };

    /**
     * closeElement()
     * Ferme tous les éléments ouvert. Contrôle l'enregistrement, affiche une demande de confirmation
     * si l'élément ouvert n'est pas enregistré.
     */
    this.closeElement = function() {
        this.closeAllModals();
        this.store.dispatch('closeElement');
    };

    /**
     * list(query, mode, vm)
     * Crée une requête pour lister les éléments de l'application
     * 
     * @param {Object} query            Paramètres de la requête sous la forme key : value
     * @param {String} mode             replace (default), update
     * @param {Function} callback       Fonction appelée après la recherche
     * @param {Object} vm               Instance VueJS
     */
    this.listElements = function(query, mode, callback, vm) {

        if ('before' in this.events.list) {
            this.events.list.before(vm);
        }

        mode = typeof mode === 'undefined' ? 'update' : mode;

        vm.pending.elements = true;
        let selfApp = this;

        this.ax.get('/'+this.api.elements+'/GET/list',{
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
                    this.events.list.success(vm);
                }
            }
            else {
                alert(apiResp.message);
                console.error(apiResp);

                if ('error' in this.events.list) {
                    this.events.list.error(vm);
                }
            }

            if ('done' in this.events.list) {
                this.events.list.done(vm);
            }

            if (typeof callback !== 'undefined') {
                callback(vm);
            }

            vm.pending.elements = false;
        })
        .catch((error) => {
            alert(error);
            console.error(error);
        });
    };

    /**
     * deleteElement(vm)
     * Envoie une demande de suppression de l'élément ouvert à l'API
     * @param {Object} vm       L'instance vueJS
     */
     this.deleteElement = function(vm) {
        if (confirm('Souhaitez vous supprimer ?')) {
            vm.pending.elements = true;

            if ('beforeDelete' in this.events.openedElement) {
                this.events.openedElement.beforeDelete(vm);
            }

            let id = this.store.state.openedElement.id;

            this.ax.post('/'+this.api.elements+'/DELETE/'+id)
            .then((resp) => {
                let apiResp = resp.data;

                if (apiResp.status === 'OK') {
                    this.store.dispatch('refreshElements', {
                        mode: 'remove',
                        elements: apiResp.data
                    });

                    if ('deleted' in this.events.openedElement) {
                        this.events.openedElement.deleted(vm);
                    }
                }
                else {
                    alert(apiResp.message);
                    console.error(apiResp);
                }
            })
            .catch((error) => {
                alert(error);
                console.error(error);
            });
        }
    };

    /**
     * record(query, options, vm)
     * Enregistre des modifications sur le serveur et gère les opérations de callback
     * 
     * @param {Object} query            La liste des modification sous la forme key: value
     * @param {Object} options          Un objet de paramétrage facultatif
     * - pending           String       Une clé de this.pending qui sera passée à true lors de l'opération
     * - callback          Function     Une fonction de callback qui prendra en premier argument la réponse du serveur et en deuxième l'objet vuejs
     * - update_data       Array/Bool   Une liste de clés à mettre à jour sur l'objet ou un booléen. Si c'est un booléen à True, alors l'ensemble des 
     *                                  éléments reçus depuis le serveur seront mis à jour
     * - id                Int          Si définit, l'ID sur lequel les données sont enregistrées. Dans le cas contraire, l'ID chargé.
     * @param {Object} vm               Instance VueJS
     */
     this.record = function(query, options, vm) {

        if ('beforeRecord' in this.events.openedElement) {
            this.events.openedElement.beforeRecord(vm);
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
            id = this.store.openedElement.id;
        }
        
        this.ax.post('/'+this.api.elements+'/POST/'+id+'?api_hierarchy=1', {
            params: query
        })
        .then((resp) => {
            let apiResp = resp.data;

            if (apiResp.status === 'OK') {

                if (options.callback) {
                    options.callback(resp, vm);
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
                    this.events.openedElement.recorded(vm);
                }
            }
            // Erreur dans la réponse
            else {
                alert('Erreur : '+apiResp.message);
                console.error(apiResp);
            }

            if (options.pending) {
                self.pending[options.pending] = false;
            }
        })
        .catch((error) => {
            alert(error);
            console.error(error);
        });
    };

    /**
     * isActive(element, vm)
     * Vérifie si l'élément passé est actif
     * 
     * @param {Object} element L'élément à vérifier
     * @returns {Boolean}
     */
    this.isActive = function(element) {
        if (this.store.state.openedElement) {
            if (element.id == this.store.state.openedElement.id) {
                return true;
            }
        }
        return false;
    };
};