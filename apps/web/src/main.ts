import { createApp } from 'vue';
import App from './ui/App.vue';
import './ui/theme/global.css';
import { loadTechnicalSliceSave } from './session/persistence';

async function bootstrap(): Promise<void> {
  const initialLoad = await loadTechnicalSliceSave();
  createApp(App, { initialLoad }).mount('#app');
}

void bootstrap();
