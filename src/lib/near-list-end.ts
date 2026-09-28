type ScrollMetrics = {
  nativeEvent: {
    layoutMeasurement: { height: number };
    contentOffset: { y: number };
    contentSize: { height: number };
  };
};

export function nearListEnd(event: ScrollMetrics, threshold = 480): boolean {
  const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
  return contentSize.height - layoutMeasurement.height - contentOffset.y < threshold;
}
