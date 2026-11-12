import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WardrobeScreen from '../screens/Wardrobe/WardrobeScreen';
import AddItemScreen from '../screens/Wardrobe/AddItemScreen';
import WardrobeCategoryScreen from '../screens/Wardrobe/WardrobeCategoryScreen';
import QuickAddScreen from '../screens/Wardrobe/QuickAddScreen';

export type WardrobeStackParamList = {
  WardrobeMain: undefined;
  AddItem: { itemToEdit?: any; category?: string; subType?: string } | undefined;
  WardrobeCategory: { category: string; subType?: string };
  QuickAdd: undefined;
};

const Stack = createNativeStackNavigator<WardrobeStackParamList>();

export default function WardrobeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WardrobeMain" component={WardrobeScreen} />
      <Stack.Screen
        name="WardrobeCategory"
        component={WardrobeCategoryScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="QuickAdd"
        component={QuickAddScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="AddItem"
        component={AddItemScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}
