import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/Home/HomeScreen';
import WardrobeNavigator from './WardrobeNavigator';
import StylistScreen from '../screens/Stylist/StylistScreen';
import CirclesScreen from '../screens/Circles/CirclesScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import CustomTabBar from './components/CustomTabBar';

export type BottomTabParamList = {
  Home: undefined;
  Wardrobe: undefined;
  Stylist: undefined;
  Circles: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Wardrobe" component={WardrobeNavigator} />
      <Tab.Screen name="Stylist" component={StylistScreen} />
      <Tab.Screen name="Circles" component={CirclesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
