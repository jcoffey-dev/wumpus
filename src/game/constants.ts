/**
 * The numbers, all of them, in one place.
 *
 * Unlike the lemonade stand's demand curve there is almost nothing to
 * reconstruct here: Yob's rules are arithmetic-free. Two pits, two bats, one
 * wumpus, five arrows, an arrow that flies through five rooms, and a wumpus
 * that wakes three times in four. The only judgement calls are marked.
 */

export const PIT_COUNT = 2
export const BAT_COUNT = 2
export const STARTING_ARROWS = 5

/** An arrow is crooked: it can be aimed through up to five rooms. */
export const MAX_ARROW_PATH = 5

/**
 * A shot wakes the wumpus three times in four, and a woken wumpus moves one
 * room -- or stays where it is, which is the fourth of its four choices.
 */
export const WUMPUS_WAKES = 0.75

export const MAX_HUNTERS = 4
export const MAX_NAME = 12

/**
 * The one addition to the 1973 rules, and it is a frame rather than a rule.
 *
 * Yob's game is a single cave: you kill the wumpus or it kills you, and
 * either way that is the end. That makes a fine two minutes and a poor
 * leaderboard -- there are only two scores, and half the players get the
 * lower one through no fault of their own.
 *
 * So a win is not the end here, it is a door. Bag the wumpus and you go
 * deeper: a fresh cave, the same twenty rooms, hazards laid out again, and
 * whatever arrows you did not spend. Death ends the expedition. The score is
 * how many you bagged before one of them got you, which is a number a board
 * can rank, and every hunt inside it is the 1973 game unaltered.
 *
 * Going deeper does not make the cave harder. It was already a coin toss
 * dressed as a deduction; stacking hazards on top would only make a long run
 * impossible rather than unlikely.
 */
export const ARROWS_PER_CAVE = 1

/** Never more than you started with, however many caves you clear. */
export const MAX_CARRIED_ARROWS = STARTING_ARROWS

/*
 * Everything the machine says, and none of it is Yob's.
 *
 * The 1973 listing has famous lines in it and they are his writing, not ours.
 * The sibling project went back and took the original's wording out of itself
 * for exactly this reason -- see NOTICE.md, and the same paragraph in the
 * lemonade stand's. A game released under a copyleft licence cannot go around
 * licensing sentences somebody else wrote.
 *
 * So these are written for this project. They carry the same information in
 * the same order, in the same shouted uppercase a printing terminal gave you,
 * because that much is the medium rather than the author.
 */

export const SENSE_TEXT: Record<'wumpus' | 'pit' | 'bats', string> = {
  wumpus: 'SOMETHING IN HERE SMELLS ALIVE',
  pit: 'THE AIR MOVES. SOMETHING NEARBY IS OPEN',
  bats: 'WINGS, SOMEWHERE CLOSE',
}

export const DEATH_TEXT: Record<string, string> = {
  eaten: 'IT FINDS YOU IN THE DARK. IT IS NOT SLOW.',
  'fell-in-a-pit': 'THE FLOOR IS NOT THERE. NEITHER IS ANYTHING ELSE.',
  'shot-yourself': 'YOUR OWN ARROW COMES BACK OUT OF THE DARK.',
  'out-of-arrows': 'THE QUIVER IS EMPTY. THE CAVE HAS ALL THE TIME IT NEEDS.',
}

export const WIN_TEXT = 'THE ARROW FINDS IT. THE CAVE GOES QUIET.'

export const BATS_TEXT = 'WINGS CLOSE ON YOU AND PUT YOU DOWN SOMEWHERE ELSE.'

/** A room with no tunnel to it. Refused, at no cost. */
export const NO_TUNNEL_TEXT = 'NO TUNNEL GOES THAT WAY'
