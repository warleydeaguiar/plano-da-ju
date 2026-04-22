import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

const PINK = '#C4607A';
const GRAY = '#8E8E93';
const BG = '#1C1C1E';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    index: '🏠',
    agenda: '📅',
    plano: '📋',
    evolucao: '📈',
    loja: '🛍️',
  };
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>
      {icons[name] ?? '●'}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: BG,
          borderTopColor: 'rgba(255,255,255,0.08)',
          height: 80,
          paddingBottom: 16,
        },
        tabBarActiveTintColor: PINK,
        tabBarInactiveTintColor: GRAY,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ focused }) => <TabIcon name="index" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ focused }) => <TabIcon name="agenda" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="plano"
        options={{
          title: 'Meu Plano',
          tabBarIcon: ({ focused }) => <TabIcon name="plano" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="evolucao"
        options={{
          title: 'Evolução',
          tabBarIcon: ({ focused }) => <TabIcon name="evolucao" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="loja"
        options={{
          title: 'Produtos',
          tabBarIcon: ({ focused }) => <TabIcon name="loja" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({});
