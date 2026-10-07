// Deck adapter: read only card props belonging to already-rendered deck canvases.
// Does not inspect the game store, sockets, or other players' hidden cards.
// Card painter adapted from PedroVIOliv/goa2-frontend-portfolio.
// Numeric-only renderer for gold/silver deck artwork. Values come from card props.
// 4. Artwork painter
// This isolated block supplies missing basic-card canvases for Deck. The internal
// m3/m2/m1/m0 names are inherited module wrappers: vocabulary, drawing, icon mapping,
// and the public card-to-painter adapter respectively. Most UI edits belong below it.
const m2Painter = (() => {
  // Painter vocabulary and sprite filenames, not a table of hero card statistics.
  const m3 = (() => {
    const Color = {
      GOLD: 'GOLD',
      SILVER: 'SILVER',
      RED: 'RED',
      BLUE: 'BLUE',
      GREEN: 'GREEN',
      PURPLE: 'PURPLE',
    };
    const Type = {
      SKILL: 'SKILL',
      ATTACK: 'ATTACK',
      MOVEMENT: 'MOVEMENT',
      DEFENSE: 'DEFENSE',
      DEFENSE_SKILL: 'DEFENSE_SKILL',
    };
    const ValueSign = {
      NONE: 'NONE',
      PLUS: 'PLUS',
      MINUS: 'MINUS',
      EXCLAMATION: 'EXCLAMATION',
    };
    const Modifier = {
      NONE: 'NONE',
      RANGE: 'RANGE',
      AREA: 'AREA',
    };
    const Item = {
      ATTACK: 'ATTACK',
      DEFENSE: 'DEFENSE',
      INITIATIVE: 'INITIATIVE',
      RANGE: 'RANGE',
      AREA: 'AREA',
      MOVEMENT: 'MOVEMENT',
    };
    const defaultEmoji = [
      'area_blue',
      'area_gold',
      'area_green',
      'area_purple',
      'area_red',
      'area_silver',
      'attack_blue',
      'attack_gold',
      'attack_green',
      'attack_red',
      'attack_silver',
      'defense_blue',
      'defense_gold',
      'defense_green',
      'defense_red',
      'defense_silver',
      'defense_skill_blue',
      'defense_skill_gold',
      'defense_skill_green',
      'defense_skill_red',
      'defense_skill_silver',
      'initiative',
      'life_counters',
      'marker_bounty',
      'marker_poison',
      'movement_blue',
      'movement_gold',
      'movement_green',
      'movement_red',
      'movement_silver',
      'range_blue',
      'range_gold',
      'range_green',
      'range_purple',
      'range_red',
      'range_silver',
      'rune_bird',
      'rune_bird_marker',
      'rune_axe',
      'rune_axe_marker',
      'rune_anvil',
      'rune_anvil_marker',
      'rune_horn',
      'rune_horn_marker',
      'skill_blue',
      'skill_gold',
      'skill_green',
      'skill_red',
      'skill_silver',
      'tiebreaker_blue',
      'tiebreaker_orange',
      'token_barrier',
      'token_blast',
      'token_dud',
      'token_glitch',
      'token_grenade',
      'token_ice',
      'token_illusion',
      'token_magma',
      'token_rock',
      'token_smoke_bomb',
      'token_totem',
      'token_tree',
      'token_zombie',
    ];
    // Static artwork manifest. These names select image assets; numeric game values
    // come from the card object passed to paintCard().
    const imageNames = [
      'area_blue',
      'area_gold',
      'area_green',
      'area_purple',
      'area_red',
      'area_silver',
      'attack',
      'attack_blue',
      'attack_gold',
      'attack_green',
      'attack_red',
      'attack_silver',
      'banner_blue_bottom',
      'banner_blue_top',
      'banner_gold_bottom',
      'banner_gold_top',
      'banner_green_bottom',
      'banner_green_top',
      'banner_red_bottom',
      'banner_red_top',
      'banner_silver_bottom',
      'banner_silver_top',
      'bottom_long',
      'bottom_short',
      'colorblind_blue',
      'colorblind_gold',
      'colorblind_green',
      'colorblind_purple',
      'colorblind_red',
      'colorblind_silver',
      'defense',
      'defense_blue',
      'defense_gold',
      'defense_green',
      'defense_red',
      'defense_silver',
      'defense_skill_blue',
      'defense_skill_gold',
      'defense_skill_green',
      'defense_skill_red',
      'defense_skill_silver',
      'frame_blue_bottom',
      'frame_blue_middle',
      'frame_blue_middle_cut',
      'frame_blue_top',
      'frame_empty_bottom',
      'frame_gold_bottom',
      'frame_gold_middle',
      'frame_gold_top',
      'frame_green_bottom',
      'frame_green_middle',
      'frame_green_middle_cut',
      'frame_green_top',
      'frame_purple_bottom',
      'frame_purple_middle',
      'frame_purple_top',
      'frame_red_bottom',
      'frame_red_middle',
      'frame_red_middle_cut',
      'frame_red_top',
      'frame_silver_bottom',
      'frame_silver_middle',
      'frame_silver_top',
      'initiative',
      'item_area',
      'item_attack',
      'item_defense',
      'item_initiative',
      'item_movement',
      'item_range',
      'level_i',
      'level_ii',
      'level_iii',
      'level_iv',
      'level_h',
      'life_counters',
      'marker_bounty',
      'marker_poison',
      'movement',
      'movement_blue',
      'movement_gold',
      'movement_green',
      'movement_red',
      'movement_silver',
      'range_blue',
      'range_gold',
      'range_green',
      'range_purple',
      'range_red',
      'range_silver',
      'rune_bird',
      'rune_bird_marker',
      'rune_axe',
      'rune_axe_marker',
      'rune_anvil',
      'rune_anvil_marker',
      'rune_horn',
      'rune_horn_marker',
      'skill_blue',
      'skill_gold',
      'skill_green',
      'skill_red',
      'skill_silver',
      'tiebreaker_blue',
      'tiebreaker_orange',
      'title',
      'title_ultimate',
      'token_barrier',
      'token_blast',
      'token_dud',
      'token_glitch',
      'token_grenade',
      'token_ice',
      'token_illusion',
      'token_magma',
      'token_rock',
      'token_smoke_bomb',
      'token_totem',
      'token_tree',
      'token_zombie',
    ];

    return { Color, Type, ValueSign, Modifier, Item, defaultEmoji, imageNames };
  })();
  // Low-level canvas compositor. Coordinates use the original 1192 × 1664 artwork
  // space; CSS scales the resulting canvas to its mobile display size.
  const m2 = (() => {
    // Draw the card in layers: background/title, action banners and numbers, then
    // description and footer. The positional arguments mirror the original renderer.
    function updateCanvas(
      canvas,
      context,
      customEmoji,
      background,
      color,
      handicap,
      extra,
      name,
      description,
      level,
      item,
      initiative,
      primaryActionType,
      primaryActionValue,
      primaryActionValueSign,
      modifier,
      modifierValue,
      modifierValueSign,
      secondaryMovementValue,
      secondaryDefenseValue,
      secondaryAttackValue,
      initiativeBonus = 0,
      attackBonus = 0,
      defenseBonus = 0,
      areaBonus = 0,
      rangeBonus = 0,
      movementBonus = 0,
    ) {
      clear(canvas, context);
      context.fillStyle = 'black';
      if (background instanceof HTMLImageElement) {
        context.drawImage(background, 0, 0, 1192, 1664);
      }
      if (color == Color.PURPLE) {
        addImage(context, 'title_ultimate', 0, 0);
        addTitle(context, name, 594, 140, 760);
      } else {
        addImage(context, 'title', 0, 0);
        addTitle(context, name, 632, 140, 710);
      }
      // Measure rules text before placing its panel so wrapping and banners agree.
      const rawDescriptionLines = description.split(/\r\n|\r|\n/);
      const descriptionLines = wrapDescriptionLines(context, rawDescriptionLines, 960);
      const descriptionHeight = descriptionLines.length;
      const descriptionLayout = getCardDescriptionLayout(context, descriptionLines);
      cardDescriptionIndent = descriptionLayout.indent;
      descriptionFontSizeAdjustment = descriptionLayout.longestLineWidth >= 1000 ? -2 : 0;
      // Missing secondary attack is represented by null, distinct from a printed zero.
      const hasSecondaryAttack = secondaryAttackValue !== null;
      const hasSecondaryMovement = color != Color.SILVER && secondaryMovementValue !== 0;
      const hasSecondaryDefense =
        primaryActionType != Type.DEFENSE && primaryActionType != Type.DEFENSE_SKILL;
      const secondaryBannerOffset =
        hasSecondaryAttack &&
        hasSecondaryMovement &&
        hasSecondaryDefense &&
        primaryActionType != Type.MOVEMENT
          ? 50
          : 0;
      context.font = '49px Arial';
      function placeSecondary(inset) {
        const adjustedInset = hasSecondaryAttack ? inset - 209 + 20 : inset;
        const attackInset = inset + 20;
        function addSecondaryAttack(atInset) {
          addImage(context, 'attack', 35, atInset - 25);
          addSecondaryValue(
            context,
            secondaryAttackValue + attackBonus,
            143,
            atInset + 121,
            attackBonus,
          );
        }
        if (!hasSecondaryMovement) {
          if (primaryActionType != Type.DEFENSE && primaryActionType != Type.DEFENSE_SKILL) {
            addImage(context, 'defense', 70, adjustedInset);
            addSecondaryValue(
              context,
              secondaryDefenseValue + defenseBonus,
              143,
              adjustedInset + 131,
              defenseBonus,
            );
          }
          if (hasSecondaryAttack) {
            addSecondaryAttack(attackInset);
          }
          return;
        }
        if (primaryActionType == Type.DEFENSE || primaryActionType == Type.DEFENSE_SKILL) {
          addImage(context, 'movement', 64, adjustedInset);
          addSecondaryValue(
            context,
            secondaryMovementValue + movementBonus,
            143,
            adjustedInset + 121,
            movementBonus,
          );
          if (hasSecondaryAttack) {
            addSecondaryAttack(attackInset);
          }
        } else if (primaryActionType == Type.MOVEMENT) {
          addImage(context, 'defense', 70, adjustedInset);
          addSecondaryValue(
            context,
            secondaryDefenseValue + defenseBonus,
            143,
            adjustedInset + 131,
            defenseBonus,
          );
          if (hasSecondaryAttack) {
            addSecondaryAttack(attackInset);
          }
        } else {
          addImage(context, 'movement', 64, adjustedInset);
          addImage(context, 'defense', 70, adjustedInset - 209);
          addSecondaryValue(
            context,
            secondaryMovementValue + movementBonus,
            143,
            adjustedInset + 121,
            movementBonus,
          );
          addSecondaryValue(
            context,
            secondaryDefenseValue + defenseBonus,
            143,
            adjustedInset - 79,
            defenseBonus,
          );
          if (hasSecondaryAttack) {
            addSecondaryAttack(attackInset);
          }
        }
      }
      function placeSecondaryOnSilver(inset) {
        const hasSecondaryAttack = secondaryAttackValue !== null;
        const adjustedInset = hasSecondaryAttack ? inset - 209 + 20 : inset;
        const attackInset = inset + 20;
        if (primaryActionType != Type.DEFENSE && primaryActionType != Type.DEFENSE_SKILL) {
          addImage(context, 'defense', 70, adjustedInset);
          addSecondaryValue(
            context,
            secondaryDefenseValue + defenseBonus,
            143,
            adjustedInset + 131,
            defenseBonus,
          );
        }
        if (hasSecondaryAttack) {
          addImage(context, 'attack', 35, attackInset - 25);
          addSecondaryValue(
            context,
            secondaryAttackValue + attackBonus,
            143,
            attackInset + 121,
            attackBonus,
          );
        }
      }
      switch (color) {
        case Color.GOLD:
          switch (descriptionHeight) {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
              if (secondaryBannerOffset > 0) addImage(context, 'banner_gold_bottom', 50, 278);
              addImage(context, 'banner_gold_bottom', 50, 278 + secondaryBannerOffset);
              addImage(context, 'banner_gold_top', 50, 0);
              placeSecondary(645 + secondaryBannerOffset);
              break;
            case 7:
              if (secondaryBannerOffset > 0) addImage(context, 'banner_gold_bottom', 50, 219);
              addImage(context, 'banner_gold_bottom', 50, 219 + secondaryBannerOffset);
              addImage(context, 'banner_gold_top', 50, 0);
              placeSecondary(586 + secondaryBannerOffset);
              break;
            default:
              if (secondaryBannerOffset > 0) addImage(context, 'banner_gold_bottom', 50, 158);
              addImage(context, 'banner_gold_bottom', 50, 158 + secondaryBannerOffset);
              addImage(context, 'banner_gold_top', 50, 0);
              placeSecondary(525 + secondaryBannerOffset);
              break;
          }
          break;
        case Color.SILVER:
          switch (descriptionHeight) {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
              if (secondaryBannerOffset > 0) addImage(context, 'banner_silver_bottom', 50, 318);
              addImage(context, 'banner_silver_bottom', 50, 318 + secondaryBannerOffset);
              addImage(context, 'banner_silver_top', 50, 0);
              placeSecondaryOnSilver(637 + secondaryBannerOffset);
              break;
            case 7:
              if (secondaryBannerOffset > 0) addImage(context, 'banner_silver_bottom', 50, 259);
              addImage(context, 'banner_silver_bottom', 50, 259 + secondaryBannerOffset);
              addImage(context, 'banner_silver_top', 50, 0);
              placeSecondaryOnSilver(578 + secondaryBannerOffset);
              break;
            default:
              if (secondaryBannerOffset > 0) addImage(context, 'banner_silver_bottom', 50, 198);
              addImage(context, 'banner_silver_bottom', 50, 198 + secondaryBannerOffset);
              addImage(context, 'banner_silver_top', 50, 0);
              placeSecondaryOnSilver(517 + secondaryBannerOffset);
              break;
          }
          break;
        case Color.RED:
          if (level == 'ii' || level == 'iii') {
            switch (descriptionHeight) {
              case 1:
              case 2:
              case 3:
              case 4:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 330);
                addImage(context, 'banner_red_bottom', 50, 330 + secondaryBannerOffset);
                addImage(context, 'banner_red_top', 50, 0);
                placeSecondary(645 + secondaryBannerOffset);
                break;
              case 5:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 271);
                addImage(context, 'banner_red_bottom', 50, 271 + secondaryBannerOffset);
                addImage(context, 'banner_red_top', 50, 0);
                placeSecondary(586 + secondaryBannerOffset);
                break;
              case 6:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 210);
                addImage(context, 'banner_red_bottom', 50, 210 + secondaryBannerOffset);
                addImage(context, 'banner_red_top', 50, 0);
                placeSecondary(525 + secondaryBannerOffset);
                break;
              default:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 150);
                addImage(context, 'banner_red_bottom', 50, 150 + secondaryBannerOffset);
                addImage(context, 'banner_red_top', 50, 0);
                placeSecondary(465 + secondaryBannerOffset);
                break;
            }
          } else {
            switch (descriptionHeight) {
              case 1:
              case 2:
              case 3:
              case 4:
              case 5:
              case 6:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 330);
                addImage(context, 'banner_red_bottom', 50, 330 + secondaryBannerOffset);
                addImage(context, 'banner_red_top', 50, 0);
                placeSecondary(645 + secondaryBannerOffset);
                break;
              case 7:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 271);
                addImage(context, 'banner_red_bottom', 50, 271 + secondaryBannerOffset);
                addImage(context, 'banner_red_top', 50, 0);
                placeSecondary(586 + secondaryBannerOffset);
                break;
              default:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 210);
                addImage(context, 'banner_red_bottom', 50, 210 + secondaryBannerOffset);
                addImage(context, 'banner_red_top', 50, 0);
                placeSecondary(525 + secondaryBannerOffset);
                break;
            }
          }
          break;
        case Color.BLUE:
          if (level == 'ii' || level == 'iii') {
            switch (descriptionHeight) {
              case 1:
              case 2:
              case 3:
              case 4:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 318);
                addImage(context, 'banner_blue_bottom', 50, 318 + secondaryBannerOffset);
                addImage(context, 'banner_blue_top', 50, 0);
                placeSecondary(645 + secondaryBannerOffset);
                break;
              case 5:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 259);
                addImage(context, 'banner_blue_bottom', 50, 259 + secondaryBannerOffset);
                addImage(context, 'banner_blue_top', 50, 0);
                placeSecondary(586 + secondaryBannerOffset);
                break;
              case 6:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 198);
                addImage(context, 'banner_blue_bottom', 50, 198 + secondaryBannerOffset);
                addImage(context, 'banner_blue_top', 50, 0);
                placeSecondary(525 + secondaryBannerOffset);
                break;
              default:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 138);
                addImage(context, 'banner_blue_bottom', 50, 138 + secondaryBannerOffset);
                addImage(context, 'banner_blue_top', 50, 0);
                placeSecondary(465 + secondaryBannerOffset);
                break;
            }
          } else {
            switch (descriptionHeight) {
              case 1:
              case 2:
              case 3:
              case 4:
              case 5:
              case 6:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 318);
                addImage(context, 'banner_blue_bottom', 50, 318 + secondaryBannerOffset);
                addImage(context, 'banner_blue_top', 50, 0);
                placeSecondary(645 + secondaryBannerOffset);
                break;
              case 7:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 259);
                addImage(context, 'banner_blue_bottom', 50, 259 + secondaryBannerOffset);
                addImage(context, 'banner_blue_top', 50, 0);
                placeSecondary(586 + secondaryBannerOffset);
                break;
              default:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 198);
                addImage(context, 'banner_blue_bottom', 50, 198 + secondaryBannerOffset);
                addImage(context, 'banner_blue_top', 50, 0);
                placeSecondary(525 + secondaryBannerOffset);
                break;
            }
          }
          break;
        case Color.GREEN:
          if (level == 'ii' || level == 'iii') {
            switch (descriptionHeight) {
              case 1:
              case 2:
              case 3:
              case 4:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 325);
                addImage(context, 'banner_green_bottom', 50, 325 + secondaryBannerOffset);
                addImage(context, 'banner_green_top', 50, 0);
                placeSecondary(645 + secondaryBannerOffset);
                break;
              case 5:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 266);
                addImage(context, 'banner_green_bottom', 50, 266 + secondaryBannerOffset);
                addImage(context, 'banner_green_top', 50, 0);
                placeSecondary(586 + secondaryBannerOffset);
                break;
              case 6:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 205);
                addImage(context, 'banner_green_bottom', 50, 205 + secondaryBannerOffset);
                addImage(context, 'banner_green_top', 50, 0);
                placeSecondary(525 + secondaryBannerOffset);
                break;
              default:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 145);
                addImage(context, 'banner_green_bottom', 50, 145 + secondaryBannerOffset);
                addImage(context, 'banner_green_top', 50, 0);
                placeSecondary(465 + secondaryBannerOffset);
                break;
            }
          } else {
            switch (descriptionHeight) {
              case 1:
              case 2:
              case 3:
              case 4:
              case 5:
              case 6:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 325);
                addImage(context, 'banner_green_bottom', 50, 325 + secondaryBannerOffset);
                addImage(context, 'banner_green_top', 50, 0);
                placeSecondary(645 + secondaryBannerOffset);
                break;
              case 7:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 266);
                addImage(context, 'banner_green_bottom', 50, 266 + secondaryBannerOffset);
                addImage(context, 'banner_green_top', 50, 0);
                placeSecondary(586 + secondaryBannerOffset);
                break;
              default:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 205);
                addImage(context, 'banner_green_bottom', 50, 205 + secondaryBannerOffset);
                addImage(context, 'banner_green_top', 50, 0);
                placeSecondary(525 + secondaryBannerOffset);
                break;
            }
          }
          break;
      }
      if (color != Color.PURPLE) {
        addImage(context, 'initiative', 26, 13);
        addInitiative(context, initiative + initiativeBonus, 143, 192, initiativeBonus);
      }
      let cardType = '';
      cardType += color == Color.GOLD || color == Color.SILVER ? 'Basic ' : '';
      if (color == Color.PURPLE) {
        cardType += 'Ultimate';
      } else {
        switch (primaryActionType) {
          case Type.SKILL:
            cardType += 'Skill';
            break;
          case Type.ATTACK:
            cardType += 'Attack';
            break;
          case Type.MOVEMENT:
            cardType += 'Movement';
            break;
          case Type.DEFENSE:
            cardType += 'Defense';
            break;
          case Type.DEFENSE_SKILL:
            if ((color == Color.GOLD || color == Color.SILVER) && modifier != Modifier.NONE)
              cardType += 'Defense/Skill';
            else cardType += 'Defense / Skill';
            break;
        }
      }
      switch (modifier) {
        case Modifier.RANGE:
          if ([Type.SKILL, Type.DEFENSE_SKILL, Type.ATTACK].includes(primaryActionType))
            cardType += ' - Ranged';
          break;
      }
      let primaryActionHeight;
      const lowerColor = color.toLowerCase();
      if (
        (level == 'ii' || level == 'iii') &&
        (color == Color.RED || color == Color.BLUE || color == Color.GREEN)
      ) {
        addImage(context, 'bottom_long', 0, 1412);
        switch (descriptionHeight) {
          case 1:
            addImage(context, 'frame_empty_bottom', 56, 1415);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
            addImage(context, 'frame_' + lowerColor + '_top', 56, 1137);
            addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
            addCardDescription(context, customEmoji, description, 596, 1358);
            addCardType(context, cardType, 596, 1200);
            primaryActionHeight = 1137;
            break;
          case 2:
            addImage(context, 'frame_empty_bottom', 56, 1415);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
            addImage(context, 'frame_' + lowerColor + '_top', 56, 1098);
            addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
            addCardDescription(context, customEmoji, descriptionLines[0], 596, 1311);
            addCardDescription(context, customEmoji, descriptionLines[1], 596, 1372);
            addCardType(context, cardType, 596, 1161);
            primaryActionHeight = 1098;
            break;
          case 3:
            addImage(context, 'frame_empty_bottom', 56, 1415);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1216);
            addImage(context, 'frame_' + lowerColor + '_top', 56, 1065);
            addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
            addCardDescription(context, customEmoji, descriptionLines[0], 596, 1262);
            addCardDescription(context, customEmoji, descriptionLines[1], 596, 1323);
            addCardDescription(context, customEmoji, descriptionLines[2], 596, 1387);
            addCardType(context, cardType, 596, 1128);
            primaryActionHeight = 1065;
            break;
          case 4:
            addImage(context, 'frame_empty_bottom', 56, 1415);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1083);
            addImage(context, 'frame_' + lowerColor + '_top', 56, 1002);
            addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
            addCardDescription(context, customEmoji, descriptionLines[0], 596, 1198);
            addCardDescription(context, customEmoji, descriptionLines[1], 596, 1259);
            addCardDescription(context, customEmoji, descriptionLines[2], 596, 1323);
            addCardDescription(context, customEmoji, descriptionLines[3], 596, 1387);
            addCardType(context, cardType, 596, 1065);
            primaryActionHeight = 1002;
            break;
          case 5:
            addImage(context, 'frame_empty_bottom', 56, 1415);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1083);
            addImage(context, 'frame_' + lowerColor + '_top', 56, 937);
            addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
            addCardDescription(context, customEmoji, descriptionLines[0], 596, 1134);
            addCardDescription(context, customEmoji, descriptionLines[1], 596, 1198);
            addCardDescription(context, customEmoji, descriptionLines[2], 596, 1259);
            addCardDescription(context, customEmoji, descriptionLines[3], 596, 1323);
            addCardDescription(context, customEmoji, descriptionLines[4], 596, 1387);
            addCardType(context, cardType, 596, 1000);
            primaryActionHeight = 937;
            break;
          case 6:
            addImage(context, 'frame_empty_bottom', 56, 1415);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1083);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1015);
            addImage(context, 'frame_' + lowerColor + '_top', 56, 864);
            addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
            addCardDescription(context, customEmoji, descriptionLines[0], 596, 1064);
            addCardDescription(context, customEmoji, descriptionLines[1], 596, 1128);
            addCardDescription(context, customEmoji, descriptionLines[2], 596, 1189);
            addCardDescription(context, customEmoji, descriptionLines[3], 596, 1253);
            addCardDescription(context, customEmoji, descriptionLines[4], 596, 1314);
            addCardDescription(context, customEmoji, descriptionLines[5], 596, 1378);
            addCardType(context, cardType, 596, 927);
            primaryActionHeight = 864;
            break;
          default:
            addImage(context, 'frame_empty_bottom', 56, 1415);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1083);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1015);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 987);
            addImage(context, 'frame_' + lowerColor + '_top', 56, 836);
            addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
            addCardDescription(context, customEmoji, descriptionLines[0], 596, 1019);
            addCardDescription(context, customEmoji, descriptionLines[1], 596, 1083);
            addCardDescription(context, customEmoji, descriptionLines[2], 596, 1144);
            addCardDescription(context, customEmoji, descriptionLines[3], 596, 1208);
            addCardDescription(context, customEmoji, descriptionLines[4], 596, 1269);
            addCardDescription(context, customEmoji, descriptionLines[5], 596, 1333);
            addCardDescription(context, customEmoji, descriptionLines[6], 596, 1397);
            addCardType(context, cardType, 596, 899);
            primaryActionHeight = 836;
            break;
        }
      } else {
        addImage(context, 'bottom_short', 0, 1413);
        switch (descriptionHeight) {
          case 1:
            addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
            addImage(context, 'frame_' + lowerColor + '_top', 56, 1244);
            addCardDescription(context, customEmoji, description, 596, 1465);
            addCardType(context, cardType, 596, 1307);
            primaryActionHeight = 1244;
            break;
          case 2:
            addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
            addImage(context, 'frame_' + lowerColor + '_top', 56, 1205);
            addCardDescription(context, customEmoji, descriptionLines[0], 596, 1418);
            addCardDescription(context, customEmoji, descriptionLines[1], 596, 1479);
            addCardType(context, cardType, 596, 1268);
            primaryActionHeight = 1205;
            break;
          case 3:
            addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1323);
            addImage(context, 'frame_' + lowerColor + '_top', 56, 1172);
            addCardDescription(context, customEmoji, descriptionLines[0], 596, 1369);
            addCardDescription(context, customEmoji, descriptionLines[1], 596, 1430);
            addCardDescription(context, customEmoji, descriptionLines[2], 596, 1494);
            addCardType(context, cardType, 596, 1235);
            primaryActionHeight = 1172;
            break;
          case 4:
            addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1190);
            addImage(context, 'frame_' + lowerColor + '_top', 56, 1109);
            addCardDescription(context, customEmoji, descriptionLines[0], 596, 1305);
            addCardDescription(context, customEmoji, descriptionLines[1], 596, 1366);
            addCardDescription(context, customEmoji, descriptionLines[2], 596, 1430);
            addCardDescription(context, customEmoji, descriptionLines[3], 596, 1494);
            addCardType(context, cardType, 596, 1172);
            primaryActionHeight = 1109;
            break;
          case 5:
            addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1190);
            addImage(context, 'frame_' + lowerColor + '_top', 56, 1044);
            addCardDescription(context, customEmoji, descriptionLines[0], 596, 1241);
            addCardDescription(context, customEmoji, descriptionLines[1], 596, 1305);
            addCardDescription(context, customEmoji, descriptionLines[2], 596, 1366);
            addCardDescription(context, customEmoji, descriptionLines[3], 596, 1430);
            addCardDescription(context, customEmoji, descriptionLines[4], 596, 1494);
            addCardType(context, cardType, 596, 1107);
            primaryActionHeight = 1044;
            break;
          case 6:
            addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1190);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1122);
            addImage(context, 'frame_' + lowerColor + '_top', 56, 971);
            addCardDescription(context, customEmoji, descriptionLines[0], 596, 1171);
            addCardDescription(context, customEmoji, descriptionLines[1], 596, 1235);
            addCardDescription(context, customEmoji, descriptionLines[2], 596, 1296);
            addCardDescription(context, customEmoji, descriptionLines[3], 596, 1360);
            addCardDescription(context, customEmoji, descriptionLines[4], 596, 1421);
            addCardDescription(context, customEmoji, descriptionLines[5], 596, 1485);
            addCardType(context, cardType, 596, 1034);
            primaryActionHeight = 971;
            break;
          case 7:
            addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1190);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1122);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1094);
            addImage(context, 'frame_' + lowerColor + '_top', 56, 943);
            addCardDescription(context, customEmoji, descriptionLines[0], 596, 1126);
            addCardDescription(context, customEmoji, descriptionLines[1], 596, 1190);
            addCardDescription(context, customEmoji, descriptionLines[2], 596, 1251);
            addCardDescription(context, customEmoji, descriptionLines[3], 596, 1315);
            addCardDescription(context, customEmoji, descriptionLines[4], 596, 1376);
            addCardDescription(context, customEmoji, descriptionLines[5], 596, 1440);
            addCardDescription(context, customEmoji, descriptionLines[6], 596, 1504);
            addCardType(context, cardType, 596, 1006);
            primaryActionHeight = 943;
            break;
          default:
            addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1552);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1386);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1326);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1190);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1122);
            addImage(context, 'frame_' + lowerColor + '_middle', 56, 1074);
            addImage(context, 'frame_' + lowerColor + '_top', 56, 923);
            addCardDescription(context, customEmoji, descriptionLines[0], 596, 1098);
            addCardDescription(context, customEmoji, descriptionLines[1], 596, 1159);
            addCardDescription(context, customEmoji, descriptionLines[2], 596, 1222);
            addCardDescription(context, customEmoji, descriptionLines[3], 596, 1286);
            addCardDescription(context, customEmoji, descriptionLines[4], 596, 1347);
            addCardDescription(context, customEmoji, descriptionLines[5], 596, 1411);
            addCardDescription(context, customEmoji, descriptionLines[6], 596, 1472);
            addCardDescription(context, customEmoji, descriptionLines[7], 596, 1536);
            addCardType(context, cardType, 596, 986);
            primaryActionHeight = 923;
            break;
        }
      }
      let modifierValueWidth = 0;
      switch (modifier) {
        case Modifier.AREA:
          addImage(context, `area_${lowerColor}`, 921, primaryActionHeight - 20);
          modifierValueWidth = addModifierValue(
            context,
            modifierValue + areaBonus,
            1052,
            primaryActionHeight + 82,
            areaBonus,
          );
          break;
        case Modifier.RANGE:
          addImage(context, `range_${lowerColor}`, 936, primaryActionHeight - 77);
          modifierValueWidth = addModifierValue(
            context,
            modifierValue + rangeBonus,
            1052,
            primaryActionHeight + 82,
            rangeBonus,
          );
          break;
      }
      if (
        (modifier == Modifier.AREA || modifier == Modifier.RANGE) &&
        (modifierValueSign == ValueSign.PLUS || modifierValueSign == ValueSign.MINUS)
      ) {
        addSign(
          context,
          modifierValueSign == ValueSign.PLUS ? '+' : '-',
          1052 + modifierValueWidth / 2,
          primaryActionHeight + 82,
        );
      }
      addImage(context, `colorblind_${lowerColor}`, 1116, 46);
      if (color == Color.RED || color == Color.BLUE || color == Color.GREEN) {
        addImage(context, `level_${level}`, 1006, 85);
        if (level == 'ii' || level == 'iii')
          addImage(context, `item_${item.toLowerCase()}`, 476, 1484);
      }
      if (color == Color.GOLD || color == Color.SILVER) {
        if (extra) {
          addExtraMarker(context);
        } else if (handicap) {
          addImage(context, 'level_h', 1008, 85);
        }
      }
      if (color == Color.PURPLE) {
        addImage(context, 'level_iv', 1008, 85);
      } else {
        let primaryValueWidth = 0;
        switch (primaryActionType) {
          case Type.SKILL:
            addImage(context, `skill_${lowerColor}`, 22, primaryActionHeight - 79);
            break;
          case Type.ATTACK:
            addImage(context, `attack_${lowerColor}`, 19, primaryActionHeight - 82);
            if (primaryActionValueSign != ValueSign.EXCLAMATION)
              primaryValueWidth = addPrimaryValue(
                context,
                primaryActionValue + attackBonus,
                142,
                primaryActionHeight + 82,
                attackBonus,
              );
            break;
          case Type.MOVEMENT:
            addImage(context, `movement_${lowerColor}`, 43, primaryActionHeight - 68);
            if (primaryActionValueSign != ValueSign.EXCLAMATION)
              primaryValueWidth = addPrimaryValue(
                context,
                primaryActionValue + movementBonus,
                142,
                primaryActionHeight + 82,
                movementBonus,
              );
            break;
          case Type.DEFENSE:
            addImage(context, `defense_${lowerColor}`, 51, primaryActionHeight - 74);
            if (primaryActionValueSign != ValueSign.EXCLAMATION)
              primaryValueWidth = addPrimaryValue(
                context,
                primaryActionValue + defenseBonus,
                142,
                primaryActionHeight + 82,
                defenseBonus,
              );
            break;
          case Type.DEFENSE_SKILL:
            addImage(context, `defense_skill_${lowerColor}`, 51, primaryActionHeight - 74);
            if (primaryActionValueSign != ValueSign.EXCLAMATION)
              primaryValueWidth = addPrimaryValue(
                context,
                primaryActionValue + defenseBonus,
                142,
                primaryActionHeight + 82,
                defenseBonus,
              );
            break;
        }
        if (primaryActionType != Type.SKILL && primaryActionValueSign != ValueSign.NONE) {
          if (primaryActionValueSign == ValueSign.EXCLAMATION)
            addBlockValue(context, '!', 142, primaryActionHeight + 82);
          else
            addSign(
              context,
              primaryActionValueSign == ValueSign.PLUS ? '+' : '-',
              142 + primaryValueWidth / 2,
              primaryActionHeight + 82,
            );
        }
      }
    }

    const { Color, defaultEmoji, imageNames, Item, Modifier, Type, ValueSign } = m3;
    // Shared loaded sprites are reused across every card instead of fetched per paint.
    const images = new Map();
    let cardDescriptionIndent = 490;
    let descriptionFontSizeAdjustment = 0;
    // Resolve only after the image is drawable; callers can await all assets together.
    function loadImage(url) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Failed to load ${url}`));
        image.src = url;
      });
    }
    // Load standard sprites and inline effect symbols into the shared image map.
    async function preloadImages() {
      const results = await Promise.allSettled(
        imageNames.filter(name => !images.has(name)).map(async (imageName) => {
          const image = await loadImage(`/cards/sheets/${imageName}.png`);
          images.set(imageName, image);
        }),
      );
      if (results.some(result => result.status === 'rejected'))
        throw new Error('Card sprites are incomplete; retry when the connection recovers');
    }
    async function importCardImage(hero, card) {
      try {
        return await loadImage(`/cards/backgrounds/${hero}/${card}.webp`);
      } catch {
        return undefined;
      }
    }
    function clear(canvas, context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    function addImage(context, name, x, y) {
      context.drawImage(images.get(name), x, y);
    }
    function addEmoji(context, name, x, y) {
      const img = images.get(name);
      context.drawImage(img, x, y, (64 * img.width) / img.height, 64);
    }
    function addCustomEmoji(context, customEmoji, name, x, y) {
      const img = customEmoji.find((item) => item[0] == name)[1];
      context.drawImage(img, x, y, (64 * img.width) / img.height, 64);
    }
    // Render one description line, including separators and inline symbol markup.
    function addCardDescription(context, customEmoji, text, x, y) {
      if (text == '---') {
        context.beginPath();
        context.moveTo(x - 381, y - 11);
        context.lineTo(x + 381, y - 11);
        context.lineWidth = 2;
        context.stroke();
      } else if (text.startsWith('>>')) {
        addTextWithBold(
          context,
          customEmoji,
          '•  ' + text.substring(2),
          x - cardDescriptionIndent,
          y,
          true,
        );
      } else if (text.startsWith('>')) {
        addTextWithBold(
          context,
          customEmoji,
          text.substring(1),
          x - (cardDescriptionIndent - 45),
          y,
          true,
        );
      } else addTextWithBold(context, customEmoji, text, x, y);
    }
    // Use the same rich-text metrics for measuring and drawing to avoid overflow.
    function getDescriptionMaxLineWidth(context, descriptionLines, fontSizeAdjustment) {
      let longestLineWidth = 0;
      descriptionLines.forEach((line) => {
        if (line.startsWith('>>')) {
          longestLineWidth = Math.max(
            longestLineWidth,
            getRichTextWidth(context, '•  ' + line.substring(2), fontSizeAdjustment),
          );
        } else if (line.startsWith('>')) {
          longestLineWidth = Math.max(
            longestLineWidth,
            getRichTextWidth(context, line.substring(1), fontSizeAdjustment) + 45,
          );
        }
      });
      return longestLineWidth;
    }
    // Break long lines at word boundaries while retaining explicit source line breaks.
    function wrapDescriptionLines(context, lines, maxWidth) {
      const out = [];
      for (const raw of lines) {
        if (raw === '---' || raw === '') {
          out.push(raw);
          continue;
        }
        let prefix = '';
        let body = raw;
        if (raw.startsWith('>>')) {
          prefix = '>>';
          body = raw.substring(2);
        } else if (raw.startsWith('>')) {
          prefix = '>';
          body = raw.substring(1);
        }
        const measure = (s) => getRichTextWidth(context, s, 0);
        if (measure(prefix + body) <= maxWidth) {
          out.push(raw);
          continue;
        }
        const words = body.split(/(\s+)/);
        let current = '';
        let firstChunk = true;
        for (const token of words) {
          if (token === '') continue;
          const candidate = current + token;
          const candidateForMeasure = firstChunk ? prefix + candidate : candidate;
          if (measure(candidateForMeasure) <= maxWidth || current === '') {
            current = candidate;
          } else {
            out.push(firstChunk ? prefix + current.trimEnd() : current.trimEnd());
            firstChunk = false;
            current = /^\s+$/.test(token) ? '' : token;
          }
        }
        if (current.length > 0) {
          out.push(firstChunk ? prefix + current.trimEnd() : current.trimEnd());
        }
      }
      return out;
    }
    // Choose description sizing and indentation from the measured text width.
    function getCardDescriptionLayout(context, descriptionLines) {
      const longestLineWidth = getDescriptionMaxLineWidth(context, descriptionLines, 0);
      const usesSmallDescriptionFont = longestLineWidth >= 1000;
      const indentationWidth = usesSmallDescriptionFont
        ? getDescriptionMaxLineWidth(context, descriptionLines, -2)
        : longestLineWidth;
      return {
        indent: indentationWidth > 980 ? indentationWidth / 2 : 490,
        longestLineWidth,
      };
    }
    // Split formatting markers into styled text segments before measuring or painting.
    function parseRichTextSegments(text) {
      const segments = [];
      let isBold = false;
      let isItalic = false;
      let index = 0;
      let buffer = '';
      const flushBuffer = () => {
        if (buffer.length > 0) {
          segments.push({
            type: 'text',
            value: buffer,
            bold: isBold,
            italic: isItalic,
          });
          buffer = '';
        }
      };
      while (index < text.length) {
        if (text.startsWith('**', index)) {
          flushBuffer();
          isBold = !isBold;
          index += 2;
          continue;
        }
        if (text[index] == '~') {
          flushBuffer();
          isItalic = !isItalic;
          index += 1;
          continue;
        }
        if (text.startsWith('::', index)) {
          const closingIndex = text.indexOf('::', index + 2);
          if (closingIndex != -1) {
            flushBuffer();
            segments.push({
              type: 'emoji',
              value: text.slice(index + 2, closingIndex),
            });
            index = closingIndex + 2;
            continue;
          }
        }
        buffer += text[index];
        index += 1;
      }
      flushBuffer();
      return segments;
    }
    // Central font selection keeps bold/italic measurement consistent with rendering.
    function getRichTextSegmentFont(
      bold,
      italic,
      fontSizeAdjustment = descriptionFontSizeAdjustment,
    ) {
      const baseSize = Math.max(1, 49 + fontSizeAdjustment);
      const italicSize = Math.max(1, 36 + fontSizeAdjustment);
      if (bold && italic) return `italic bold ${italicSize}px Arial`;
      if (bold) return `bold ${baseSize}px Arial`;
      if (italic) return `italic ${italicSize}px Arial`;
      return `${baseSize}px Arial`;
    }
    // Sum segment widths rather than measuring the raw formatting markup.
    function getRichTextWidth(context, text, fontSizeAdjustment = descriptionFontSizeAdjustment) {
      const segments = parseRichTextSegments(text);
      return segments.reduce((sum, segment) => {
        if (segment.type == 'emoji') return sum + 64;
        context.font = getRichTextSegmentFont(segment.bold, segment.italic, fontSizeAdjustment);
        return sum + context.measureText(segment.value).width;
      }, 0);
    }
    // Draw styled segments and embedded symbols in sequence using their measured widths.
    function addTextWithBold(context, customEmoji, text, x, y, left = false) {
      context.textAlign = 'left';
      const segments = parseRichTextSegments(text);
      const fullTextWidth = segments.reduce((sum, segment) => {
        if (segment.type == 'emoji') return sum + 64;
        context.font = getRichTextSegmentFont(segment.bold, segment.italic);
        return sum + context.measureText(segment.value).width;
      }, 0);
      let indent = 0;
      segments.forEach((segment) => {
        if (segment.type == 'emoji') {
          if (defaultEmoji.includes(segment.value))
            addEmoji(context, segment.value, x - (left ? 0 : fullTextWidth / 2) + indent, y - 50);
          if (customEmoji.find((item) => item[0] == segment.value))
            addCustomEmoji(
              context,
              customEmoji,
              segment.value,
              x - (left ? 0 : fullTextWidth / 2) + indent,
              y - 50,
            );
          indent += 64;
        } else {
          context.font = getRichTextSegmentFont(segment.bold, segment.italic);
          const partWidth = context.measureText(segment.value).width;
          context.fillText(segment.value, x - (left ? 0 : fullTextWidth / 2) + indent, y);
          indent += partWidth;
        }
      });
      context.textAlign = 'center';
    }
    function addCardType(context, text, x, y) {
      addOutlinedText(context, text, x, y, 54, 6, 604);
    }
    // A dark outline keeps numbers and labels legible over detailed artwork.
    function addOutlinedText(context, text, x, y, fontSize, outlineSize, widthLimit) {
      context.font = `${fontSize}px Modesto Poster`;
      context.lineWidth = outlineSize;
      context.strokeText(text, x, y, widthLimit);
      context.fillStyle = 'white';
      context.fillText(text, x, y, widthLimit);
      context.fillStyle = 'black';
    }
    function addExtraMarker(context) {
      const previousAlign = context.textAlign;
      context.textAlign = 'center';
      addOutlinedText(context, '>', 1060, 150, 90, 8);
      context.textAlign = previousAlign;
    }
    function addTitle(context, text, x, y, widthLimit) {
      context.textAlign = 'center';
      context.font = '66px Modesto Poster';
      context.fillText(text, x, y, widthLimit);
    }
    function addInitiative(context, value, x, y, bonus) {
      addSquishedOutlinedText(context, value.toString(), x, y, 197, 14, 0.92, false, bonus);
    }
    function addModifierValue(context, value, x, y, bonus = 0) {
      return addSquishedOutlinedText(
        context,
        value.toString(),
        x,
        y,
        156,
        14,
        0.875,
        false,
        bonus,
      );
    }
    function addBlockValue(context, value, x, y, bonus = 0) {
      return addSquishedOutlinedText(context, value, x, y, 156, 14, 0.875, false, bonus);
    }
    function addPrimaryValue(context, value, x, y, bonus = 0) {
      return addSquishedOutlinedText(
        context,
        value.toString(),
        x,
        y,
        156,
        14,
        0.875,
        false,
        bonus,
      );
    }
    function addSign(context, text, x, y) {
      addSquishedOutlinedText(context, text, x, y, 156, 14, 0.875, true);
    }
    function addSecondaryValue(context, value, x, y, bonus = 0) {
      addSquishedOutlinedText(context, value.toString(), x, y, 136, 14, 0.875, false, bonus);
    }
    // Render to a temporary canvas, then compress horizontally to fit a narrow slot.
    // This preserves the intended text height when a value is wider than its icon.
    function addSquishedOutlinedText(
      context,
      text,
      x,
      y,
      fontSize,
      outlineSize,
      squishness,
      left = false,
      bonus = 0,
    ) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 400;
      tempCanvas.height = 400;
      const tempContext = tempCanvas.getContext('2d');
      tempContext.textAlign = left ? 'left' : 'center';
      tempContext.font = `${fontSize}px Modesto Poster`;
      tempContext.lineWidth = outlineSize;
      tempContext.strokeText(text, 200, 200);
      switch (bonus) {
        case 0:
          tempContext.fillStyle = 'white';
          break;
        case 1:
          tempContext.fillStyle = 'palegreen';
          break;
        case 2:
          tempContext.fillStyle = 'powderblue';
          break;
        case 3:
          tempContext.fillStyle = 'plum';
          break;
      }
      tempContext.fillText(text, 200, 200);
      tempContext.fillStyle = 'black';
      context.drawImage(
        tempCanvas,
        0,
        0,
        400,
        400,
        x - 200 * squishness,
        y - 200,
        400 * squishness,
        400,
      );
      return tempContext.measureText(text).width * squishness;
    }

    return { updateCanvas, images, preloadImages, importCardImage };
  })();
  // Map effect-text icon names to site assets and color-specific painter sprites.
  const m1 = (() => {
    // Some action sprites have no purple variant; use the silver artwork for those.
    const ABSENT_PURPLE = {
      purple: 'silver',
    };
    function withColor(base, color, fallbacks = {}) {
      return `${base}_${fallbacks[color] ?? color}`;
    }
    const CARD_ICONS = {
      attack: {
        iconPath: '/icons/attack.png',
        painterSprite: (c) => withColor('attack', c, ABSENT_PURPLE),
      },
      defense: {
        iconPath: '/icons/defense.png',
        painterSprite: (c) => withColor('defense', c, ABSENT_PURPLE),
      },
      movement: {
        iconPath: '/icons/movement.png',
        painterSprite: (c) => withColor('movement', c, ABSENT_PURPLE),
      },
      range: {
        iconPath: '/icons/range.png',
        painterSprite: (c) => withColor('range', c),
      },
      radius: {
        iconPath: '/icons/radius.png',
        painterSprite: (c) => withColor('area', c),
      },
      initiative: {
        iconPath: '/icons/initiative.png',
        painterSprite: () => 'initiative',
      },
      poison_marker: {
        iconPath: '/icons/marker_poison.png',
        painterSprite: () => 'marker_poison',
      },
      bounty_marker: {
        iconPath: '/icons/marker_bounty.png',
        painterSprite: () => 'marker_bounty',
      },
      life_counter: {
        iconPath: '/icons/life_counters.png',
        painterSprite: () => 'life_counters',
      },
      smoke_bomb_token: {
        iconPath: '/icons/token_smoke_bomb.png',
        painterSprite: () => 'token_smoke_bomb',
      },
      grenade_token: {
        iconPath: '/icons/token_grenade.png',
        painterSprite: () => 'token_grenade',
      },
      blast_token: {
        iconPath: '/icons/token_blast.png',
        painterSprite: () => 'token_blast',
      },
      dud_token: {
        iconPath: '/icons/token_dud.png',
        painterSprite: () => 'token_dud',
      },
      zombie_token: {
        iconPath: '/icons/token_zombie.png',
        painterSprite: () => 'token_zombie',
      },
    };

    return { CARD_ICONS };
  })();
  // Public painter adapter: normalize a website card object into drawing arguments.
  const m0 = (() => {
    const { CARD_ICONS } = m1;
    const { importCardImage, preloadImages, updateCanvas } = m2;
    const { Color, Item, Modifier, Type, ValueSign } = m3;
    const CARD_W = 1192;
    const CARD_H = 1664;
    let assetsReadyPromise = null;
    // Share one in-flight promise so simultaneous Deck cards wait on the same assets.
    function ensureCardAssetsReady() {
      if (assetsReadyPromise) return assetsReadyPromise;
      assetsReadyPromise = Promise.allSettled([
        preloadImages(),
        document.fonts
          .load(`16px "Modesto Poster"`)
          .then(() => document.fonts.ready)
          .then(() => undefined),
      ]).then(results => {
        const failed = results.find(result => result.status === 'rejected');
        if (failed) throw failed.reason;
      }).catch(error => {
        assetsReadyPromise = null;
        throw error;
      });
      return assetsReadyPromise;
    }
    // Cache promises as well as completed backgrounds to avoid duplicate requests.
    const bgCache = new Map();
    function loadCardBackground(heroSlug, imageId) {
      const key = `${heroSlug}/${imageId}`;
      const existing = bgCache.get(key);
      if (existing) return existing;
      const p = importCardImage(heroSlug, imageId).then(image => {
        if (!image) bgCache.delete(key);
        return image;
      });
      bgCache.set(key, p);
      return p;
    }
    const TIER_TO_LEVEL = {
      I: 'i',
      II: 'ii',
      III: 'iii',
      IV: 'iv',
      UNTIERED: 'i',
    };
    const VALID_COLORS = new Set(Object.values(Color));
    const VALID_TYPES = new Set(Object.values(Type));
    const VALID_ITEMS = new Set(Object.values(Item));
    function tierToLevel(tier) {
      return TIER_TO_LEVEL[tier] ?? 'i';
    }
    function asColor(c) {
      return c && VALID_COLORS.has(c) ? c : Color.GOLD;
    }
    function asType(t) {
      return t && VALID_TYPES.has(t) ? t : Type.ATTACK;
    }
    function asItem(i) {
      return i && VALID_ITEMS.has(i) ? i : Item.ATTACK;
    }
    function valueSign(v) {
      return v < 0 ? ValueSign.MINUS : ValueSign.NONE;
    }
    // Convert website :icon: tokens to the painter’s ::sprite:: notation.
    // Unknown tokens are left untouched rather than silently deleted.
    function translateEffectIcons(text, color) {
      const colorLower = color.toLowerCase();
      return text.replace(/(?<!:):([a-z_]+):(?!:)/g, (match, name) => {
        const def = CARD_ICONS[name];
        if (!def) return match;
        return `::${def.painterSprite(colorLower)}::`;
      });
    }
    // Read printed stats only. Hero upgrades are applied by text/list renderers, not Deck.
    function paintCard(canvas, ctx, card, background) {
      const color = asColor(card.color);
      const primaryType = asType(card.primary_action);
      const primaryValue = card.primary_action_value ?? 0;
      const secondary = card.secondary_actions ?? {};
      const secondaryMovement = secondary.MOVEMENT ?? 0;
      const secondaryDefense = secondary.DEFENSE ?? 0;
      const secondaryAttack = 'ATTACK' in secondary ? secondary.ATTACK : null;
      let modifier = Modifier.NONE;
      let modifierValue = 0;
      if (card.radius_value != null) {
        modifier = Modifier.AREA;
        modifierValue = card.radius_value;
      } else if (card.range_value != null) {
        modifier = Modifier.RANGE;
        modifierValue = card.range_value;
      }
      updateCanvas(
        canvas,
        ctx,
        [],
        background,
        color,
        false,
        false,
        card.name ?? '',
        translateEffectIcons(card.effect_text ?? '', color),
        tierToLevel(card.tier),
        asItem(card.item),
        card.initiative ?? 0,
        primaryType,
        Math.abs(primaryValue),
        valueSign(primaryValue),
        modifier,
        modifierValue,
        ValueSign.NONE,
        secondaryMovement,
        secondaryDefense,
        secondaryAttack,
      );
    }

    return { CARD_W, CARD_H, ensureCardAssetsReady, loadCardBackground, paintCard };
  })();
  return m0;
})();
