import { Tabs, router } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { T, GRAD } from '../../lib/theme/tokens';

function FABButton() {
  return (
    <TouchableOpacity
      style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', marginTop: -22 }}
      onPress={() => router.push('/checkin')}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={GRAD.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: T.accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.45,
          shadowRadius: 10,
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={30} color="#FFF" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(242,242,247,0.95)',
          borderTopColor: 'rgba(0,0,0,0.12)',
          borderTopWidth: 0.5,
          height: 84,
          paddingTop: 8,
          paddingBottom: 0,
        },
        tabBarActiveTintColor: T.accent,
        tabBarInactiveTintColor: T.sub,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="progresso"
        options={{
          title: 'Progresso',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="registrar"
        options={{
          title: '',
          tabBarButton: () => <FABButton />,
        }}
      />
      <Tabs.Screen
        name="plano"
        options={{
          title: 'Plano',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'clipboard' : 'clipboard-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="acompanhamento"
        options={{
          title: 'Ju',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* Hidden tabs — tabBarButton: () => null removes them from the visible bar */}
      <Tabs.Screen name="agenda" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="evolucao" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="loja" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="perfil" options={{ tabBarButton: () => null }} />
    </Tabs>
  );
}
