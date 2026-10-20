import { useThree } from '@react-three/fiber'

/** Upright phones get their own, narrower table. */
export function usePortrait(): boolean {
  const size = useThree((state) => state.size)
  return size.width / size.height < 0.95
}
