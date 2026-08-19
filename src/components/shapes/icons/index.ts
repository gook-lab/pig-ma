/**
 * Shape Icons - Progressive Disclosure Pattern
 *
 * 도형 아이콘을 카테고리별로 분리하여 필요할 때만 로드합니다.
 * React.lazy를 사용하여 코드 스플리팅을 적용합니다.
 */

export {
  BasicShapeIcon,
  BASIC_SHAPE_VARIANTS,
  isBasicShape,
} from "./BasicShapeIcons";
export {
  FlowchartShapeIcon,
  FLOWCHART_SHAPE_VARIANTS,
  isFlowchartShape,
} from "./FlowchartShapeIcons";
