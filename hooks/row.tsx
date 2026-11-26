import type { ClientModule } from 'claude-code'

// The taxi_horse row, as register.tsx hands it over: the line drawn as it is.
//
// The surface knows what the hooks module cannot: whether the window the row
// is drawn in has the focus, and whether the viewer asked for less motion.
// The row tells the hooks module when either changes, and the picture is
// redrawn less often with nobody looking (see frame() in register.tsx). A
// build too old to say leaves them undefined: the window is taken to have the
// focus, and motion as it always was.

// What the row has told the hooks module.
type Sight = { isFocused: boolean; isMotionReduced: boolean }

const Row: ClientModule<{ line: string }, Sight> = (props, surface) => {
  const { Text } = surface.elements
  const sight: Sight = {
    isFocused: surface.isWindowFocused !== false,
    isMotionReduced: surface.isMotionReduced === true,
  }
  const told = surface.state
  if (told === undefined || told.isFocused !== sight.isFocused || told.isMotionReduced !== sight.isMotionReduced) {
    surface.post(sight)
    surface.setState(sight)
  }

  return <Text>{props.line}</Text>
}

export default Row
