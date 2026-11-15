// Further reading per body system. These are the papers cited in the team's design mockup. Each
// one was looked up on 15 November 2026 in PubMed (or, for the one physics journal, Crossref)
// and its title matches the paper at the address given. They are pointers for the reader, not
// the source of anything written on this screen: the screen's own statements come from
// research.generated.ts. A system with no entry had no citation that could be matched.

import type { SystemId } from './systems'

export type FurtherReading = { citation: string; url: string; linkText: string }

const pubmed = (id: string) => ({ url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, linkText: `PubMed ${id}` })

export const furtherReading: Readonly<Record<SystemId, readonly FurtherReading[]>> = {
  cardiovascular: [
    {
      citation:
        'Hughson RL, Helm A, Durante M. Heart in space: effect of the extraterrestrial environment on the cardiovascular system. Nature Reviews Cardiology, 2018',
      ...pubmed('29053152'),
    },
    {
      citation:
        'Auñón-Chancellor SM et al. Venous thrombosis during spaceflight. New England Journal of Medicine, 2020',
      ...pubmed('31893522'),
    },
  ],
  pulmonary: [],
  skeletal: [
    {
      citation:
        'Lang T et al. Cortical and trabecular bone mineral loss from the spine and hip in long-duration spaceflight. Journal of Bone and Mineral Research, 2004',
      ...pubmed('15125798'),
    },
    {
      citation:
        'LeBlanc A et al. Bone mineral and lean tissue loss after long duration space flight. Journal of Musculoskeletal and Neuronal Interactions, 2000',
      ...pubmed('15758512'),
    },
  ],
  renal: [
    {
      citation:
        'Siew K et al. Cosmic kidney disease: an integrated pan-omic, physiological and morphological study into spaceflight-induced renal dysfunction. Nature Communications, 2024',
      ...pubmed('38862484'),
    },
    {
      citation:
        'Whitson PA et al. Renal stone risk assessment during Space Shuttle flights. Journal of Urology, 1997',
      ...pubmed('9366381'),
    },
  ],
  nervous: [
    {
      citation:
        'Lee AG et al. Spaceflight associated neuro-ocular syndrome (SANS) and the neuro-ophthalmologic effects of microgravity: a review and an update. npj Microgravity, 2020',
      ...pubmed('32047839'),
    },
    {
      citation:
        'Mader TH et al. Optic disc edema in an astronaut after repeat long-duration space flight. Journal of Neuro-Ophthalmology, 2013',
      ...pubmed('23851997'),
    },
  ],
  'sleep-psychological': [
    {
      citation:
        'Barger LK et al. Prevalence of sleep deficiency and use of hypnotic drugs in astronauts before, during, and after spaceflight: an observational study. Lancet Neurology, 2014',
      ...pubmed('25127232'),
    },
    {
      citation:
        'Flynn-Evans EE et al. Circadian misalignment affects sleep and medication use before and during spaceflight. npj Microgravity, 2016',
      ...pubmed('28725719'),
    },
  ],
  digestive: [
    {
      citation:
        'Voorhies AA et al. Study of the impact of long-duration space missions at the International Space Station on the astronaut microbiome. Scientific Reports, 2019',
      ...pubmed('31289321'),
    },
  ],
  immune: [
    {
      citation:
        'Crucian BE et al. Immune system dysregulation during spaceflight: potential countermeasures for deep space exploration missions. Frontiers in Immunology, 2018',
      ...pubmed('30018614'),
    },
    {
      citation:
        'Mehta SK et al. Reactivation of latent viruses is associated with increased plasma cytokines in astronauts. Cytokine, 2013',
      ...pubmed('23107825'),
    },
  ],
  metabolic: [
    {
      citation: 'Smith SM, Zwart SR. Nutritional biochemistry of spaceflight. Advances in Clinical Chemistry, 2008',
      ...pubmed('19004188'),
    },
  ],
  radiation: [
    {
      citation:
        'Durante M, Cucinotta FA. Physical basis of radiation protection in space travel. Reviews of Modern Physics, 2011',
      url: 'https://doi.org/10.1103/RevModPhys.83.1245',
      linkText: 'doi.org/10.1103/RevModPhys.83.1245',
    },
    {
      citation:
        'Cucinotta FA, Durante M. Cancer risk from exposure to galactic cosmic rays: implications for space exploration by human beings. Lancet Oncology, 2006',
      ...pubmed('16648048'),
    },
  ],
}
