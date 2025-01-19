import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DefaultText } from './default-text';
import { friendlyDate } from '../util/util';

type Props = {
  timestamp: Date;
};

const MessageDivider = ({ timestamp }: Props) => {
  return (
    <DefaultText style={styles.text}>{friendlyDate(timestamp)}</DefaultText>
  );
};

const styles = StyleSheet.create({
  text: {
    alignSelf: 'center',
    paddingTop: 58,
    paddingBottom: 12,
    fontSize: 12,
    color: '#999',
    fontWeight: '700',
    marginHorizontal: 8,
    textTransform: 'uppercase',
  },
});

export {
  MessageDivider,
}
