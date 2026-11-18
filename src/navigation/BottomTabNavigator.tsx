import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/Home/HomeScreen';
import FeedScreen from '../screens/Feed/FeedScreen';
import EarnScreen from '../screens/Earn/EarnScreen';
import GovtScreen from '../screens/Civic/GovtScreen';
import LawsScreen from '../screens/Civic/LawsScreen';
import HospitalsScreen from '../screens/Civic/HospitalsScreen';
import WardrobeNavigator from './WardrobeNavigator';
import StylistScreen from '../screens/Stylist/StylistScreen';
import CirclesScreen from '../screens/Circles/CirclesScreen';
import MeScreen from '../screens/Profile/MeScreen';
import CustomTabBar from './components/CustomTabBar';

export type BottomTabParamList = {
  Home: undefined;
  Feed: { refreshAt?: number } | undefined;
  Earn: undefined;
  Govt: undefined;
  Laws: undefined;
  Hospitals: undefined;
  Stylist: undefined;
  Wardrobe: undefined;
  // tab: open a Circles tab directly
  Circles: { tab?: 'mine' | 'discover' | 'nearby' } | undefined;
  Me: undefined;
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
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Earn" component={EarnScreen} />
      <Tab.Screen name="Govt" component={GovtScreen} />
      <Tab.Screen name="Laws" component={LawsScreen} />
      <Tab.Screen name="Hospitals" component={HospitalsScreen} />
      <Tab.Screen name="Stylist" component={StylistScreen} />
      <Tab.Screen name="Wardrobe" component={WardrobeNavigator} />
      <Tab.Screen name="Circles" component={CirclesScreen} />
      <Tab.Screen name="Me" component={MeScreen} />
    </Tab.Navigator>
  );
}
