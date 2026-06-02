// App.js
// Akış: dil seçimi -> karşılama -> form (wizard) -> teşekkür.
// Şık fontlar: Playfair Display (başlık) + Inter (gövde) — @expo-google-fonts.
// Gerekli paketler:
//   npx expo install expo-font @expo-google-fonts/playfair-display @expo-google-fonts/inter expo-app-loading
import React, { useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Inter_400Regular } from '@expo-google-fonts/inter';
import { DancingScript_700Bold } from '@expo-google-fonts/dancing-script';

import { LanguageProvider } from './i18n/LanguageContext';
import LanguageSelect from './screens/LanguageSelect';
import WelcomeScreen from './screens/WelcomeScreen';
import ThankYouScreen from './screens/ThankYouScreen';
import HomeScreen from './screens/HomeScreen';
import CvWizard from './wizard/CvWizard';

// Akış aşamaları
const STAGE = { LANG: 'lang', WELCOME: 'welcome', FORM: 'form', THANKS: 'thanks', HOME: 'home' };

function Root() {
  const [stage, setStage] = useState(STAGE.LANG);
  const [data, setData] = useState({});
  const update = (patch) => setData((d) => ({ ...d, ...patch }));

  const [fontsReady] = useFonts({ PlayfairDisplay_700Bold, Inter_400Regular, DancingScript_700Bold });

  const handleSubmit = () => {
    // Backend gelince: supabase.from('cvs').upsert({ ...data, lang }) burada çağrılacak.
    console.log('CV gönderildi (örnek):', data);
    setStage(STAGE.HOME);
  };

  const startNew = () => { setData({}); setStage(STAGE.LANG); };

  switch (stage) {
    case STAGE.WELCOME:
      return <WelcomeScreen fontsReady={fontsReady} onStart={() => setStage(STAGE.FORM)} onBack={() => setStage(STAGE.LANG)} />;
    case STAGE.FORM:
      return (
        <CvWizard
          data={data}
          onChange={update}
          onExit={() => setStage(STAGE.WELCOME)}
          onFinish={() => setStage(STAGE.THANKS)}
        />
      );
    case STAGE.THANKS:
      return (
        <ThankYouScreen
          fontsReady={fontsReady}
          onSubmit={handleSubmit}
          onBack={() => setStage(STAGE.FORM)}
        />
      );
    case STAGE.HOME:
      return (
        <HomeScreen
          fontsReady={fontsReady}
          data={data}
          onEdit={() => setStage(STAGE.FORM)}
          onNew={startNew}
        />
      );
    case STAGE.LANG:
    default:
      return <LanguageSelect onDone={() => setStage(STAGE.WELCOME)} />;
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider initialLang="tr">
        <View style={styles.flex}>
          <StatusBar barStyle="light-content" />
          <Root />
        </View>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#1b2533' },
});
