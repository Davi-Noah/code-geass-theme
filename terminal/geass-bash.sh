# This file is loaded by bash as an alternative rcfile. It preserves the user's
# normal configuration and changes only the prompt for this terminal profile.
if [[ -f "$HOME/.bashrc" ]]; then
  source "$HOME/.bashrc"
fi

GEASS_CRIMSON='\[\e[38;2;240;90;130m\]'
GEASS_GOLD='\[\e[38;2;231;188;93m\]'
GEASS_VIOLET='\[\e[38;2;201;168;242m\]'
GEASS_DIM='\[\e[38;2;126;111;143m\]'
GEASS_RESET='\[\e[0m\]'

PS1="${GEASS_CRIMSON}◈${GEASS_RESET} ${GEASS_GOLD}\w${GEASS_RESET} ${GEASS_VIOLET}❯${GEASS_RESET} "

printf '\e[38;2;126;111;143mGEASS REQUIEM // terminal contract active\e[0m\n'

unset GEASS_CRIMSON GEASS_GOLD GEASS_VIOLET GEASS_DIM GEASS_RESET
