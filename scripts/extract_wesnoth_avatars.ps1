# Script to extract Wesnoth unit avatars from local installation
# Location: C:\Users\carlo\scoop\apps\wesnoth\1.18.5\data\core\images\units

$unitsPath = "C:\Users\carlo\scoop\apps\wesnoth\1.18.5\data\core\images\units"

# Map of unit folders and representative files
$avatarMap = @(
    @{name="Fighter"; path="human-loyalists\fighter.png"; era="Human"},
    @{name="Knight"; path="human-loyalists\knight.png"; era="Human"},
    @{name="Paladin"; path="human-loyalists\paladin.png"; era="Human"},
    @{name="Bowman"; path="human-loyalists\bowman.png"; era="Human"},
    @{name="Ranger"; path="human-loyalists\ranger.png"; era="Human"},
    @{name="Mage"; path="human-magi\mage.png"; era="Human"},
    @{name="Wizard"; path="human-magi\wizard.png"; era="Human"},
    @{name="Priest"; path="human-loyalists\priest.png"; era="Human"},
    @{name="Spearman"; path="human-loyalists\spearman.png"; era="Human"},
    @{name="Swordsman"; path="human-loyalists\swordsman.png"; era="Human"},
    @{name="Elf Fighter"; path="elves-wood\fighter.png"; era="Elf"},
    @{name="Elf Archer"; path="elves-wood\archer.png"; era="Elf"},
    @{name="Elf Ranger"; path="elves-wood\ranger.png"; era="Elf"},
    @{name="Elf Mage"; path="elves-wood\mage.png"; era="Elf"},
    @{name="Elf Druid"; path="elves-wood\druid.png"; era="Elf"},
    @{name="Dwarf Fighter"; path="dwarves\fighter.png"; era="Dwarf"},
    @{name="Dwarf Warrior"; path="dwarves\warrior.png"; era="Dwarf"},
    @{name="Dwarf Scout"; path="dwarves\scout.png"; era="Dwarf"},
    @{name="Dwarf Miner"; path="dwarves\miner.png"; era="Dwarf"},
    @{name="Orc Warrior"; path="orcs\warrior.png"; era="Orc"},
    @{name="Orc Shaman"; path="orcs\shaman.png"; era="Orc"},
    @{name="Orc Archer"; path="orcs\archer.png"; era="Orc"},
    @{name="Goblin"; path="goblins\goblin.png"; era="Goblin"},
    @{name="Skeleton"; path="undead-skeletal\skeleton.png"; era="Undead"},
    @{name="Zombie"; path="undead\zombie.png"; era="Undead"},
    @{name="Ghost"; path="undead-spirit\ghost.png"; era="Undead"},
    @{name="Lich"; path="undead-necromancers\lich.png"; era="Undead"},
    @{name="Drake Fighter"; path="drakes\fighter.png"; era="Drake"},
    @{name="Drake Burner"; path="drakes\burner.png"; era="Drake"},
    @{name="Drake Clasher"; path="drakes\clasher.png"; era="Drake"},
    @{name="Drake Glider"; path="drakes\glider.png"; era="Drake"},
    @{name="Merfolk"; path="merfolk\fighter.png"; era="Merfolk"},
    @{name="Nagas"; path="nagas\warrior.png"; era="Nagas"},
    @{name="Troll"; path="trolls\troll.png"; era="Troll"},
    @{name="Ogre"; path="ogres\ogre.png"; era="Ogre"},
    @{name="Wose"; path="woses\wose.png"; era="Wose"},
    @{name="Saurian"; path="saurians\fighter.png"; era="Saurian"},
    @{name="Dunefolk"; path="dunefolk\fighter.png"; era="Dunefolk"},
    @{name="Bat"; path="bats\bat.png"; era="Monster"},
    @{name="Outlaw"; path="human-outlaws\outlaw.png"; era="Outlaw"}
)

# Check which files exist
$existingAvatars = @()
foreach ($avatar in $avatarMap) {
    $fullPath = Join-Path $unitsPath $avatar.path
    if (Test-Path $fullPath) {
        $existingAvatars += $avatar
        Write-Host "[OK] $($avatar.name) - $($avatar.path)"
    } else {
        Write-Host "[MISSING] $($avatar.name) - $($avatar.path)"
    }
}

Write-Host "`nTotal existing avatars: $($existingAvatars.Count)"
Write-Host "Total mapped avatars: $($avatarMap.Count)"

# Export to JSON for database insertion
$existingAvatars | ConvertTo-Json | Out-File -FilePath ".\wesnoth_avatars.json" -Encoding UTF8
Write-Host "`nAvatars exported to: .\wesnoth_avatars.json"

