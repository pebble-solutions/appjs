import axios from "axios";
import { getAuth, getIdToken } from "firebase/auth";
import { BadConfigurationException, NoStructureException, StructureNotFoundException, UnableToReauthenticateException } from "../exceptions/ApiExceptions";
import {Licence} from "../models/Licence";
import { AuthStatus } from "../models/AuthStatus";
import { LocalUser } from "../models/LocalUser";

export class ApiController {

    constructor(options) {
        options = typeof options === 'undefined' ? {} : options;

        this.ax = axios.create();
        this.licence = options.licence;
        this.local_user = options.local_user;
        this.auth_server = options.auth_server;
        this.baseURL = options.baseURL;
        this.setStructure(options.structure?.id);
        this.setAuth(options.token);
        this.setBaseURL(options.baseURL);
    }

    /**
     * Authentifie ou ré-authentifie si nécessaire l'utilisateur auprès de l'API.
     * 
     * Les informations suivantes doivent être initialisées au préalable :
     * - licence        {Licence}
     * - auth_server    {AuthServer}
     * 
     * Le système tentera de récupérer l'utilisateur stocké dans le sessionStorage du navigateur
     * puis contrôlera la validité de la session. En cas de session toujours valide, le serveur
     * n'est pas ré-intérogé, on concidère que l'utilisateur est authentifié.
     * 
     * @param {object} options
     * - force {boolean}            false (défaut). Si true, le sessionStorage et toutes les informations
     *                              pré-enregistrées sont ignorées
     *
     * @throws {BadConfigurationException}
     * @throws {NoStructureException}
     * 
     * @returns {Promise<LocalUser>}
     */
    async auth(options) {
        options = options ?? { force: false };

        return new Promise((resolve, reject) => {

            // Contrôle des informations d'initialisation
            if (!this.licence || !this.licence?.apiBaseURL) {
                reject(new BadConfigurationException('licence.apiBaseURL'));
            }
            if (!this.auth_server || !this.auth_server?.url) {
                reject(new BadConfigurationException('auth_server.url'));
            }

            if (!this.local_user) {
                this.local_user = new LocalUser();
                if (!options.force) {
                    this.local_user.fromSessionStorage();
                }
            }

            return (new Promise((resolve, reject) => {
                // Une authentification auprès du serveur est nécessaire
                if (!this.local_user.isAuthenticated || options.force) {
                    let auth = getAuth();

                    return getIdToken(auth.currentUser).then(idtk => {
                        return axios.get('licences/'+this.licence.id, {
                            headers: {
                                "Authorization": "Bearer "+idtk
                            },
                            baseURL: this.auth_server.url
                        });
                    })
                    .then(licence => {
                        this.licence = new Licence(licence.data);

                        let data = new FormData();
        
                        return axios.post('auth?_pas', data, {
                            headers: {
                                "Authorization": "Bearer "+this.licence.pasIdToken
                            },
                            baseURL: this.licence.apiBaseURL
                        });
                    })
                    .then(resp => {
                        this.local_user = new LocalUser(resp.data.data);
                        this.local_user.toSessionStorage();
                        resolve(this.local_user);
                    })
                    .catch(error => reject(error));
                }
                else {
                    resolve(this.local_user);
                }
            })).then(() => {
                // Modification de l'URL de base
                if (this.baseURL != this.licence.apiBaseURL) {
                    this.setBaseURL(this.licence.apiBaseURL);
                }

                // Modification du Bearer token en en-tête de requête
                if (this.token != this.local_user.token.jwt) {
                    this.setAuth(this.local_user.token.jwt);
                }

                // Ajout du header de la structure si il n'existe pas ou qu'il ne figure pas dans les structures de l'utilisateur
                let structureFound = false;
    
                if (this.structure) {
                    structureFound = this.local_user.structures.find(e => e.id == this.structure.id);
                }
    
                if (!structureFound) {
                    const structureId = this.local_user.login.primary_structure ?? this.local_user.structures[0]?.id;
    
                    if (structureId) {
                        this.setStructure(structureId);
                    }
                    else {
                        reject(new NoStructureException());
                    }
                }
    
                resolve(this.local_user);
            })
            .catch((error) => reject(error));
        });
    }

    /**
     * Envoie une requête GET à l'API
     * 
     * @param {string} route La route de l'API après la baseUrl
     * @param {object} query Les paramètres passés en GET
     * @param {object} axiosConfig Configuration du framework Axios (https://axios-http.com/docs/req_config)
     * @param {object} options 
     * - reauthenticated {boolean} true lorsque la requête a déjà été rententée
     * 
     * @return {Promise<object>}
     */
    async get(route, query, axiosConfig, options) {

        options = options ?? {};

        axiosConfig = axiosConfig ?? {};
        axiosConfig.params = query;

        try {
            await this.auth()
            let resp = await this.ax.get(route, axiosConfig);
            return 'data' in resp.data ? resp.data.data : resp.data;
        }
        catch (error) {
            await this.tryAgainOrThrow(error, options);
            return await this.get(route, query, axiosConfig, { reauthenticated : true });
        }

    }

    /**
     * Envoie une requête POST à l'API
     * 
     * @param {string} route La route de l'API après baseUrl
     * @param {object} query Les paramètres passés en POST
     * @param {object} axiosConfig Configuration du framework Axios (https://axios-http.com/docs/req_config)
     * @param {object} options 
     * - reauthenticated {boolean} true lorsque la requête a déjà été rententée
     * 
     * @returns {Promise<object>}
     */
    async post(route, query, axiosConfig, options) {
        try {
            await this.auth()

            let data = new FormData();
            for (let key in query) {
                data.append(key, query[key]);
            }

            let resp = await this.ax.post(route, data, axiosConfig);
            return 'data' in resp.data ? resp.data.data : resp.data;
        }
        catch (error) {
            await this.tryAgainOrThrow(error, options);
            return await this.post(route, query, axiosConfig, { reauthenticated : true });
        }
    }

    /**
     * En cas d'échec d'une requête avec un code http 401, le système tentera une reconnexion forcée.
     * 
     * @param {object} lastError Erreur renvoyée à la première exécution de la requête
     * @param {object} options 
     * - reauthenticated {boolean} true lorsque la requête a déjà été rententée
     * 
     * @throws {UnableToReauthenticateException}
     * 
     * @return {Promise<boolean>}
     */
     async tryAgainOrThrow(lastError, options) {

        options = options ?? {};

        if (!options.reauthenticated && lastError?.response?.status === 401) {
            const status = this.authStatus();
            // L'authentification a expirée, la requête sera relancé après une réauthentifcation complète
            if ( !status.isAuthenticated ) {
                try {
                    await this.auth({force : true});
                    return true;

                }
                catch (error) {
                    throw new UnableToReauthenticateException();
                }
            }
        }
        throw lastError;
    }

    /**
     * Vérifie le status d'authentification auprès de l'API
     * 
     * @returns {Promise<AuthStatus>}
     */
    async authStatus() {
        let authStatus = new AuthStatus();

        try {
            let resp = await this.ax.get('checkAuth');
            authStatus.fromResponse(resp);
        }
        catch (error) {
            authStatus.fromError(error);
        }

        return authStatus;
    }

    /**
     * Ajoute une entête Structure à toutes les requêtes
     * 
     * @param {number|null} structureId ID de la structure à ajouter en entête
     * 
     * @throws {StructureNotFoundException}
     * 
     * @return {ApiController}
     */
    setStructure(structureId) {
        if (structureId) {
            let structure = this.local_user?.structures?.find(e => e.id == structureId);
    
            if (!structure) {
                throw new StructureNotFoundException(structureId);
            }
    
            this.structure = structure;
        }
        else {
            this.structure = null;
        }

        this.ax.defaults.headers.common['Structure'] = structureId;

        return this;
    }

    /**
     * Ajoute une entête Authorization avec un Bearer token à toutes les requêtes
     * 
     * @param {string} token Token d'authentification à l'API
     * 
     * @return {ApiController}
     */
    setAuth(token) {
        this.token = token;
        let authorization = token ? 'Bearer '+token : '';
        this.ax.defaults.headers.common['Authorization'] = authorization;
        return this;
    }

    /**
     * Défini l'URL de base de l'API vers laquelle toutes les routes seront conduites
     * 
     * @param {string} url L'URL de base de l'API
     * 
     * @return {ApiController}
     */
    setBaseURL(url) {
        this.ax.defaults.baseURL = url;
        this.baseURL = url;
        return this;
    }

    /**
     * Vide la session courante. Ne conserve que les informations du serveur d'authentification.
     */
    clearSession() {
        this.licence = null;
        this.local_user?.clearSession();
        this.local_user = null;
        this.setStructure(null);
        this.setAuth(null);
        this.setBaseURL(null);
    }

}