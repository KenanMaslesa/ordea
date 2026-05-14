import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const vibrateWeb = (pattern: number | number[]) => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
};

export const haptic = {
  light() {
    if (Platform.OS === "web") {
      vibrateWeb(10);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  },

  medium() {
    if (Platform.OS === "web") {
      vibrateWeb([20, 30, 20]);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  },

  success() {
    if (Platform.OS === "web") {
      vibrateWeb([30, 40, 30]);
    } else {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
    }
  },

  error() {
    if (Platform.OS === "web") {
      vibrateWeb([50, 40, 50]);
    } else {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error
      );
    }
  },
};
