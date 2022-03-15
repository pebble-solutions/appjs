import App from "./app"
import CONFIG from "@/config.json"

export default {
    install(app) {
        app.config.globalProperties.$app = new App({
			api: CONFIG.api,
			name: CONFIG.name,
			cfg: CONFIG.cfg,
			cfgMenu: CONFIG.cfgMenu,
			cfgSlots: CONFIG.cfgSlots,
			firebaseConfig: CONFIG.firebaseConfig
		});
    }
}