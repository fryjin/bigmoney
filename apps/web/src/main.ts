import { createApp } from 'vue';
import App from './ui/App.vue';
import './ui/theme/global.css';
import { getBrowserTestFixtureForInitialLoad } from './session/browserTestFixtures';
import { CURRENT_GAME_CONTENT } from './session/currentGameContent';
import { loadLocalGameSave } from './session/persistence';

async function bootstrap(): Promise<void> {
  const initialLoad = await loadLocalGameSave(CURRENT_GAME_CONTENT);
  const browserTestFixture = getBrowserTestFixtureForInitialLoad(
    initialLoad,
    import.meta.env.MODE,
    new URLSearchParams(window.location.search).get('fixture')
  );
  createApp(App, { initialLoad, browserTestFixture }).mount('#app');
}

void bootstrap();
