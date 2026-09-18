import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WardrobeScreen from '../screens/Wardrobe/WardrobeScreen';
import AddItemScreen from '../screens/Wardrobe/AddItemScreen';

export type WardrobeStackParamList = {
  WardrobeMain: undefined;
  AddItem: undefined;
};

const Stack = createNativeStackNavigator<WardrobeStackParamList>();

export default function WardrobeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WardrobeMain" component={WardrobeScreen} />
      <Stack.Screen
        name="AddItem"
        component={AddItemScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}
