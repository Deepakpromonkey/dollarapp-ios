import { Fonts } from '@/constants/fonts';
import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { Text, TextProps, TextStyle } from 'react-native';

type Variant =
  | 'h1'      
  | 'h2'      
  | 'h3'      
  | 'title'   
  | 'body'   
  | 'label' 
  | 'label1'  
  | 'caption' 
  | 'tiny';   

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: keyof AppTheme;
  style?: TextStyle | TextStyle[];
}

const variantStyles: Record<Variant, TextStyle> = {
  h1:      { fontFamily: Fonts.bold,     fontSize: 32 },
  h2:      { fontFamily: Fonts.bold,     fontSize: 24 },
  h3:      { fontFamily: Fonts.semiBold, fontSize: 20 },
  title:   { fontFamily: Fonts.semiBold, fontSize: 18 },
  body:    { fontFamily: Fonts.regular,  fontSize: 16 },
  label:   { fontFamily: Fonts.medium,   fontSize: 14 },
  label1:   { fontFamily: Fonts.regular,   fontSize: 14 },
  caption: { fontFamily: Fonts.regular,  fontSize: 13 },
  tiny:    { fontFamily: Fonts.regular,  fontSize: 10 },
};

export default function AppText({
  variant = 'body',
  color = 'text',
  style,
  ...props
}: AppTextProps) {
  const theme = useAppTheme();

  return (
    <Text
      style={[variantStyles[variant], { color: theme[color] }, style]}
      {...props}
    />
  );
}
