declare module "react-simple-maps" {
  import { ComponentType, ReactNode } from "react";

  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: {
      scale?: number;
      center?: [number, number];
      rotate?: [number, number, number];
      parallels?: [number, number];
    };
    width?: number;
    height?: number;
    style?: React.CSSProperties;
    children?: ReactNode;
  }

  export interface GeographyProps {
    geography: any;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: {
      default?: React.CSSProperties;
      hover?: React.CSSProperties;
      pressed?: React.CSSProperties;
    };
  }

  export interface MarkerProps {
    coordinates: [number, number];
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    style?: React.CSSProperties;
    children?: ReactNode;
  }

  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const Geographies: ComponentType<{
    geography: string;
    children: (args: { geographies: any[] }) => ReactNode;
  }>;
  export const Geography: ComponentType<GeographyProps>;
  export const Marker: ComponentType<MarkerProps>;
}
