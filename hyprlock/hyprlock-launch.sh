#!/bin/bash

TEMPLATE_BASE_HEIGHT=1080
GENERATED_CONF="/tmp/hyprlock-generated.conf"

BASE_FONT_WELCOME=55
BASE_FONT_TIME=40
BASE_FONT_DATE=19
BASE_FONT_USER=16
BASE_IMAGE_SIZE=95
BASE_IMAGE_BORDER=2
BASE_BOX_W=320
BASE_BOX_H=55
BASE_Y_WELCOME=320
BASE_Y_TIME=240
BASE_Y_DATE=175
BASE_Y_IMAGE=25
BASE_Y_BOX=-140
BASE_Y_INPUT=-220

scale_val() {
    printf "%.0f" "$(echo "$1 * $2" | bc -l)"
}

cat > "$GENERATED_CONF" << 'EOF'
background {
    monitor =
    path = /home/josh/Pictures/wallpapers/mountains_sunset.jpg
}

general {
    no_fade_in = false
    grace = 0
    disable_loading_bar = false
}
EOF

MONITOR_NAME=""
RES_W=""
RES_H=""

while IFS= read -r line; do

    if [[ "$line" =~ ^Monitor\ (.+)\ \(ID ]]; then
        MONITOR_NAME="${BASH_REMATCH[1]}"
        RES_W=""
        RES_H=""
    fi

    if [[ "$line" =~ ([0-9]+)x([0-9]+)@[0-9.]+\ at ]]; then
        RES_W="${BASH_REMATCH[1]}"
        RES_H="${BASH_REMATCH[2]}"
    fi

    if [[ "$line" =~ scale:[[:space:]]+([0-9.]+) ]] && [[ -n "$MONITOR_NAME" ]] && [[ -n "$RES_H" ]]; then
        SCALE="${BASH_REMATCH[1]}"

        LOGICAL_H=$(printf "%.0f" "$(echo "$RES_H / $SCALE" | bc -l)")
        FACTOR=$(echo "scale=6; $LOGICAL_H / $TEMPLATE_BASE_HEIGHT" | bc -l)

        FONT_WELCOME=$(scale_val $BASE_FONT_WELCOME $FACTOR)
        FONT_TIME=$(scale_val $BASE_FONT_TIME $FACTOR)
        FONT_DATE=$(scale_val $BASE_FONT_DATE $FACTOR)
        FONT_USER=$(scale_val $BASE_FONT_USER $FACTOR)
        IMG_SIZE=$(scale_val $BASE_IMAGE_SIZE $FACTOR)
        IMG_BORDER=$(scale_val $BASE_IMAGE_BORDER $FACTOR)
        BOX_W=$(scale_val $BASE_BOX_W $FACTOR)
        BOX_H=$(scale_val $BASE_BOX_H $FACTOR)
        Y_WELCOME=$(scale_val $BASE_Y_WELCOME $FACTOR)
        Y_TIME=$(scale_val $BASE_Y_TIME $FACTOR)
        Y_DATE=$(scale_val $BASE_Y_DATE $FACTOR)
        Y_IMAGE=$(scale_val $BASE_Y_IMAGE $FACTOR)
        Y_BOX=$(scale_val $BASE_Y_BOX $FACTOR)
        Y_INPUT=$(scale_val $BASE_Y_INPUT $FACTOR)

        cat >> "$GENERATED_CONF" << EOF

# ── $MONITOR_NAME (${RES_W}x${RES_H} scale ${SCALE}, logical ${LOGICAL_H}px tall) ──

label {
    monitor = $MONITOR_NAME
    text = Welcome!
    color = rgba(216, 222, 233, .75)
    font_size = $FONT_WELCOME
    font_family = SF Pro Display Bold
    position = 0, $Y_WELCOME
    halign = center
    valign = center
}

label {
    monitor = $MONITOR_NAME
    text = cmd[update:1000] echo "<span>\$(date +"%I:%M")</span>"
    color = rgba(216, 222, 233, .75)
    font_size = $FONT_TIME
    font_family = SF Pro Display Bold
    position = 0, $Y_TIME
    halign = center
    valign = center
}

label {
    monitor = $MONITOR_NAME
    text = cmd[update:1000] echo -e "\$(date +"%A, %B %d")"
    color = rgba(216, 222, 233, .75)
    font_size = $FONT_DATE
    font_family = SF Pro Display Bold
    position = 0, $Y_DATE
    halign = center
    valign = center
}

image {
    monitor = $MONITOR_NAME
    path = ~/.config/hypr/vivek.png
    border_size = $IMG_BORDER
    border_color = rgba(255, 255, 255, .75)
    size = $IMG_SIZE
    rounding = -1
    rotate = 0
    reload_time = -1
    reload_cmd =
    position = 0, $Y_IMAGE
    halign = center
    valign = center
}

shape {
    monitor = $MONITOR_NAME
    size = $BOX_W, $BOX_H
    color = rgba(255, 255, 255, .1)
    rounding = -1
    border_size = 0
    border_color = rgba(255, 255, 255, 1)
    rotate = 0
    xray = false
    position = 0, $Y_BOX
    halign = center
    valign = center
}

label {
    monitor = $MONITOR_NAME
    text =   \$USER
    color = rgba(216, 222, 233, 0.80)
    outline_thickness = 0
    dots_size = 0.2
    dots_spacing = 0.2
    dots_center = true
    font_size = $FONT_USER
    font_family = SF Pro Display Bold
    position = 0, $Y_BOX
    halign = center
    valign = center
}

input-field {
    monitor = $MONITOR_NAME
    size = $BOX_W, $BOX_H
    outline_thickness = 0
    dots_size = 0.2
    dots_spacing = 0.2
    dots_center = true
    outer_color = rgba(255, 255, 255, 0)
    inner_color = rgba(255, 255, 255, 0.1)
    font_color = rgb(200, 200, 200)
    fade_on_empty = false
    font_family = SF Pro Display Bold
    placeholder_text = <i><span foreground="##ffffff99">   Enter Pass</span></i>
    hide_input = false
    position = 0, $Y_INPUT
    halign = center
    valign = center
}
EOF
    fi

done < <(hyprctl monitors)

hyprlock --config "$GENERATED_CONF"
