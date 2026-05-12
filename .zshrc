# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:/usr/local/bin:$PATH

export ZSH="$HOME/.oh-my-zsh"

ZSH_THEME="agnosterzak"

plugins=(
    git
    archlinux
    zsh-autosuggestions
    zsh-syntax-highlighting
)

source $ZSH/oh-my-zsh.sh

# Check archlinux plugin commands here
# https://github.com/ohmyzsh/ohmyzsh/tree/master/plugins/archlinux

# Display Pokemon-colorscripts
# Project page: https://gitlab.com/phoneybadger/pokemon-colorscripts#on-other-distros-and-macos
#pokemon-colorscripts --no-title -s -r #without fastfetch
#pokemon-colorscripts --no-title -s -r | fastfetch -c $HOME/.config/fastfetch/config-pokemon.jsonc --logo-type file-raw --logo-height 10 --logo-width 5 --logo -

# fastfetch. Will be disabled if above colorscript was chosen to install
###fastfetch -c $HOME/.config/fastfetch/config-compact.jsonc
fastfetch -c $HOME/.config/fastfetch/config.jsonc

# Set-up icons for files/directories in terminal using lsd
alias ls='lsd'
alias l='ls -l'
alias la='ls -a'
alias lla='ls -la'
alias lt='ls --tree'
alias k='clear -x'
alias j='LINES=$(tput lines); HALF=$((LINES / 2)); printf "\n%.0s" {1..$HALF}; tput cuu $HALF'

clear_scrollback() { clear -x }
zle -N clear_scrollback
bindkey '^K' clear_scrollback

half_clear() {
	LINES=$(tput lines)
	HALF=$((LINES/2))
	printf "\n%.0s" {1..$HALF}
	tput cuu $HALF
}
zle -N half_clear
bindkey '^J' half_clear

HISTFILE=~/.zsh_history
HISTSIZE=10000
SAVEHIST=10000
setopt appendhistory
