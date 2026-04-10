import votingSplashStyles from "./MatchVotingOverlay/MatchVotingOverlay.module.css";

export {
  MatchVoteRoot,
  type MatchVoteRootProps,
  type MatchVoteRevoteCandidatesPair,
} from "./MatchVoteRoot";
export {
  MatchVotingOverlay,
  type MatchVotingOverlayPlayer,
  type MatchVotingOverlayProps,
} from "./MatchVotingOverlay";
export type { VotingSplashProps } from "./matchVoteRoot.types";
export { votingSplashStyles };
export { VotingHeadlineStrips, type VotingHeadlineStripsProps } from "./VotingHeadlineStrips";
export { VotingSubtitleStrip, type VotingSubtitleStripProps } from "./VotingSubtitleStrip";
export { RevoteVsLogo, type RevoteVsLogoProps } from "./RevoteVsLogo";
export { VotingPhaseRevoteCandidates } from "./VotingPhaseRevoteCandidates";
export {
  VotingPhaseNoVote,
  noVotePhaseStackVariants,
} from "./VotingPhaseNoVote";
export { VotingCard, type VotingCardPlayer } from "./VotingCard";
export {
  MATCH_VOTING_COPY,
  VOTING_STRIPE_ASSETS,
  VOTING_BACKDROP_DECOR_SRC,
  VOTING_BACKDROP_DECOR_ASSETS,
  backdropDecorSrcForVariant,
  VOTING_BACKDROP_DECOR_BLUR_PX,
  VOTING_BACKDROP_DECOR_BRIGHTNESS,
  VOTING_BACKDROP_DECOR_FADE_IN_SEC,
  VOTING_NO_VOTE_BACKDROP_LOTTIE_SRC,
  VOTING_NO_VOTE_BACKDROP_LOTTIE_SPEED,
  VOTING_NO_VOTE_BACKDROP_LOTTIE_BASE_PX,
  VOTING_NO_VOTE_BACKDROP_LOTTIE_COMPOSITION_PX,
  VOTING_NO_VOTE_BACKDROP_LOTTIE_COVER_BLEED,
  VOTING_NO_VOTE_BACKDROP_LOTTIE_OFFSET_Y_PX,
  VOTING_NO_VOTE_BACKDROP_LOTTIE_OPACITY,
  matchVotingDecoConfig,
  MATCH_VOTING_DECO_TABLET_MAX_WIDTH_PX,
  MATCH_VOTING_DECO_PHONE_MAX_WIDTH_PX,
  MATCH_VOTING_DECO_MOBILE_MAX_WIDTH_PX,
  matchVotingDecoTabletOverrides,
  matchVotingDecoPhoneOverrides,
  matchVotingDecoNarrowOverrides,
  matchVotingDecoForViewport,
  type MatchVotingDecoViewportFlags,
  stripeImageForVariant,
  getOpenStripEnterOffsetPx,
  getStripCloseMotionWindowSec,
  getHudBottomStripeTransform,
  getHudTopStripeTransform,
  type MatchVotingDecoConfig,
  type MatchVotingDecoLayerTransform,
  type MatchVotingDecoOpenStripConfig,
  type MatchVotingDecoMarqueeConfig,
  type MatchVotingDecoTextConfig,
  type MatchVotingHudCompositionAnchor,
  type MatchVotingHudCompositionConfig,
  type MatchVotingCenterPhase,
  type VoteStripeVariant,
  matchVotingRevoteVsConfig,
  type MatchVotingRevoteVsConfig,
  type MatchVotingRevoteVsLetter,
  type MatchVotingRevoteVsEntryAnimationConfig,
  type MatchVotingRevoteRotationConfig,
  MATCH_VOTING_REVOTE_ENTRY_EASE,
  matchVotingRevoteCandidateCardsConfig,
  matchVotingRevoteVsForViewport,
  matchVotingRevoteCandidateCardsForViewport,
  getRevoteCandidateCardsEntryDurationSec,
  type MatchVotingRevoteCandidateCardsConfig,
  type MatchVotingRevoteViewportFlags,
} from "./voting.config";
