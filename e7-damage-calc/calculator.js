const resolve = () => {
  const artifact = new Artifact(document.getElementById('artifact').value);
  const hero = new Hero(document.getElementById('hero').value, artifact);

  for (const dotType of [dot.bleed, dot.burn]) {
    document.getElementById(`${dotType}-damage-block`).style.display = 'none';
  }

  for (const dotType of hero.dot || []) {
    document.getElementById(`${dotType}-damage-block`).style.display = 'inline-block';
    document.getElementById(`${dotType}-damage`).innerText = Math.round(hero.getDotDamage(dotType)).toString();
  }

  const table = document.getElementById('damage');
  table.innerHTML = '';
  for (const skillId of Object.keys(hero.skills)) {
    const skill = hero.skills[skillId];

    if (skill.rate !== undefined) {
      const damage = hero.getDamage(skillId);
      $(table).append(`<tr><td>${skillId.toUpperCase()}</td><td>${damage.crit}</td><td>${damage.crush}</td><td>${damage.normal}</td><td>${damage.miss}</td></tr>`);

      if (skill.soulburn) {
        const damage = hero.getDamage(skillId, true);
        $(table).append(`<tr><td>${skillId.toUpperCase()} Soulburn</td><td>${damage.crit}</td><td>${damage.crush}</td><td>${damage.normal}</td><td>${damage.miss}</td></tr>`);
      }
    }
  }
};

const getGlobalAtkMult = () => {
  let mult = 1.0;

  for (let checkboxId of ['elem-adv', 'atk-up', 'atk-up-great', 'target']) {
    const elem = document.getElementById(checkboxId);
    mult *= elem.checked ? Number(elem.value) : 1.0;
  }

  if (elements.caster_vigor.value()) {
    mult *= 1.3;
  }

  if (elements.caster_enrage.value()) {
    mult *= 1.1;
  }

  return mult;
};

const getGlobalPowerMult = () => {
  let mult = 1.0;

  for (let checkboxId of ['target', 'rage-set']) {
    const elem = document.getElementById(checkboxId);
    mult *= elem.checked ? Number(elem.value) : 1.0;
  }

  return mult;
};

const getGlobalDefMult = () => {
  let mult = 1.0;

  for (let checkboxId of ['def-up', 'def-down']) {
    const elem = document.getElementById(checkboxId);
    mult *= elem.checked ? Number(elem.value) : 1.0;
  }

  return mult;
};

class Hero {
  constructor(id, artifact) {
    this.atk = Number(document.getElementById('atk').value);
    this.crit = Number(document.getElementById('crit').value);
    this.skills = heroes[id].skills;
    this.dot = heroes[id].dot;
    this.artifact = artifact;
    this.target = new Target(artifact);
  }

  getDamage(skillId, soulburn = false) {
    const skill = this.skills[skillId];
    const hit = this.offensivePower(skillId, soulburn) / this.target.defensivePower(skill);
    const critDmg = (this.crit / 100)+(skill.critDmgBoost ? skill.critDmgBoost(soulburn) : 0);
    return {
      crit: Math.round(hit*critDmg + this.getAfterMathDamage(skillId, critDmg)),
      crush: Math.round(hit*1.3 + this.getAfterMathDamage(skillId, 1.3)),
      normal: Math.round(hit + this.getAfterMathDamage(skillId, 1)),
      miss: Math.round(hit*0.75 + this.getAfterMathDamage(skillId, 0.75))
    };
  }

  getAttack(skillId) {
    const skill = this.skills[skillId];

    if (skill.atk !== undefined) {
      return skill.atk();
    } else {
      return this.atk * getGlobalAtkMult()
    }
  }

  offensivePower(skillId, soulburn) {
    const skill = this.skills[skillId];

    const atkTotal = this.getAttack(skillId);

    const powerTotal = 1.871 * (typeof skill.pow === 'function' ? skill.pow(soulburn) : skill.pow);
    const multTotal = (skill.mult ? skill.mult(soulburn) : 1) * this.getSkillEnhanceMult(skillId) * powerTotal * this.artifact.getDamageMultiplier() * getGlobalPowerMult();

    return (atkTotal * (typeof skill.rate === 'function' ? skill.rate(soulburn) : skill.rate) + (skill.flat ? skill.flat(soulburn) : 0)) * multTotal;
  }

  getSkillEnhanceMult(skillId) {
    const skill = this.skills[skillId];
    let mult = 1.0;

    if (skill.enhance) {
      const enhancement = Number(document.getElementById(`molagora-${skillId}`).value);
      for (let i = 0; i < enhancement; i++) {
        mult += skill.enhance[i];
      }
    }

    return mult;
  }

  getAfterMathDamage(skillId, multiplier) {
    const detonation = this.getDetonateDamage(skillId);

    let artiDamage = 0;
    const artiMultipliers = this.artifact.getAfterMathMultipliers();
    if (artiMultipliers !== null) {
      artiDamage = this.atk*artiMultipliers.atkPercent*getGlobalAtkMult()/this.target.defensivePower({penetrate: () => artiMultipliers.penetrate})*multiplier;
    }

    const artiFlatDmg = this.artifact.getAfterMathDamage();
    if (artiFlatDmg > 0) {
      artiDamage = (artiFlatDmg*this.getSkillEnhanceMult())/this.target.defensivePower()*multiplier
    }

    return detonation + artiDamage;
  }

  getDetonateDamage(skillId) {
    const skill = this.skills[skillId];
    switch (skill.detonate) {
      case dot.bleed:
        return elements.target_bleed_detonate.value()*skill.detonation()*this.atk*0.3*getGlobalAtkMult()/this.target.defensivePower({penetrate: () => 0.7});
      case dot.burn:
        return elements.target_burn_detonate.value()*skill.detonation()*this.atk*0.6*getGlobalAtkMult()/this.target.defensivePower({penetrate: () => 0.7});
      default: return 0;
    }
  }

  getDotDamage(type) {
    switch (type) {
      case dot.bleed:
        return this.atk*0.3*getGlobalAtkMult()/this.target.defensivePower({penetrate: () => 0.7});
      case dot.burn:
        return this.atk*0.6*getGlobalAtkMult()/this.target.defensivePower({penetrate: () => 0.7});
      default: return 0;
    }
  }
}

class Target {
  constructor(casterArtifact) {
    this.def = Number(document.getElementById('def').value);
    this.casterArtifact = casterArtifact;
  }

  defensivePower(skill) {
    return (((this.def * getGlobalDefMult()) / 300)*(1-(skill && skill.penetrate ? skill.penetrate() : 0)-this.casterArtifact.getDefensePenetration())) + 1;
  }
}

class Artifact {
  constructor(id) {
    this.id = id ? id : undefined;
  }

  getValue() {
    return artifacts[this.id].scale[Math.floor(document.getElementById('artifact-lvl').value/3)]
  }

  getDamageMultiplier() {
    if (this.id === undefined || artifacts[this.id].type !== artifactDmgType.damage) {
      return 1;
    }
    return this.getValue();
  }

  getDefensePenetration() {
    if (this.id === undefined || artifacts[this.id].type !== artifactDmgType.penetrate) {
      return 0;
    }
    return this.getValue();
  }

  getAfterMathMultipliers() {
    if (this.id === undefined || artifacts[this.id].type !== artifactDmgType.aftermath || artifacts[this.id].atkPercent === undefined || artifacts[this.id].penetrate === undefined) {
      return null;
    }
    return {
      atkPercent: artifacts[this.id].atkPercent,
      penetrate: artifacts[this.id].penetrate,
    }
  }

  getAfterMathDamage() {
    if (this.id === undefined || artifacts[this.id].type !== artifactDmgType.aftermath || artifacts[this.id].damage === undefined) {
      return 0;
    }
    return artifacts[this.id].damage(this.getValue());
  }
}