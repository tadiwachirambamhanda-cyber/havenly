// Compiled from UAE Ministry of Education / CAA sources and cross-checked
// against known gaps in public listings (e.g. Wikipedia's UAE university
// list omits University of Sharjah entirely). Cross-referenced a second time
// against Dubai Knowledge Park and Dubai International Academic City tenant
// listings specifically — that pass also surfaced a false positive
// (University of Exeter's "Dubai presence" is just a recruitment office, not
// an actual campus) that was correctly left out. Deliberately excludes
// specialized military/diplomatic academies and small satellite outposts
// we couldn't confidently verify as current — add more as needed.
export interface UniversityOption {
  name: string;
  emirate: string;
}

export const UNIVERSITIES: UniversityOption[] = [
  { name: 'United Arab Emirates University', emirate: 'Abu Dhabi' },
  { name: 'Zayed University', emirate: 'Abu Dhabi' },
  { name: 'Khalifa University', emirate: 'Abu Dhabi' },
  { name: 'NYU Abu Dhabi', emirate: 'Abu Dhabi' },
  { name: 'Sorbonne University Abu Dhabi', emirate: 'Abu Dhabi' },
  { name: 'Al Ain University', emirate: 'Abu Dhabi' },
  { name: 'Higher Colleges of Technology', emirate: 'Abu Dhabi' },
  { name: 'Abu Dhabi University', emirate: 'Abu Dhabi' },
  { name: 'American University in Dubai', emirate: 'Dubai' },
  { name: 'University of Wollongong in Dubai', emirate: 'Dubai' },
  { name: 'Canadian University Dubai', emirate: 'Dubai' },
  { name: 'The British University in Dubai', emirate: 'Dubai' },
  { name: 'Heriot-Watt University Dubai', emirate: 'Dubai' },
  { name: 'Middlesex University Dubai', emirate: 'Dubai' },
  { name: 'Murdoch University Dubai', emirate: 'Dubai' },
  { name: 'Manipal Academy of Higher Education Dubai', emirate: 'Dubai' },
  { name: 'BITS Pilani Dubai', emirate: 'Dubai' },
  { name: 'Amity University Dubai', emirate: 'Dubai' },
  { name: 'Curtin University Dubai', emirate: 'Dubai' },
  { name: 'Rochester Institute of Technology Dubai', emirate: 'Dubai' },
  { name: 'University of Birmingham Dubai', emirate: 'Dubai' },
  { name: 'S P Jain School of Global Management', emirate: 'Dubai' },
  { name: 'University of Dubai', emirate: 'Dubai' },
  { name: 'Hamdan Bin Mohammed Smart University', emirate: 'Dubai' },
  { name: 'Mohammed Bin Rashid University of Medicine and Health Sciences', emirate: 'Dubai' },
  { name: 'Islamic Azad University Dubai', emirate: 'Dubai' },
  { name: 'Al Ghurair University', emirate: 'Dubai' },
  { name: 'American University in the Emirates', emirate: 'Dubai' },
  { name: 'De Montfort University Dubai', emirate: 'Dubai' },
  { name: 'Hult International Business School', emirate: 'Dubai' },
  { name: 'Emirates Aviation University', emirate: 'Dubai' },
  { name: 'Institute of Management Technology Dubai', emirate: 'Dubai' },
  { name: 'IIM Ahmedabad Dubai Campus', emirate: 'Dubai' },
  { name: 'St. Joseph University Dubai', emirate: 'Dubai' },
  { name: 'SZABIST Dubai', emirate: 'Dubai' },
  { name: 'Strathclyde Business School Dubai', emirate: 'Dubai' },
  { name: 'American University of Sharjah', emirate: 'Sharjah' },
  { name: 'University of Sharjah', emirate: 'Sharjah' },
  { name: 'Skyline University College', emirate: 'Sharjah' },
  { name: 'Ajman University', emirate: 'Ajman' },
  { name: 'Gulf Medical University', emirate: 'Ajman' },
  { name: 'American University of Ras Al Khaimah', emirate: 'Ras Al Khaimah' },
  { name: 'RAK Medical and Health Sciences University', emirate: 'Ras Al Khaimah' },
  { name: 'University of Fujairah', emirate: 'Fujairah' },
];
