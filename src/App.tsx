import React, { useState } from 'react';
import { Search, Building2, Briefcase, Loader2, Users, Building, MapPin, Mail, Code } from 'lucide-react';
import OpenAI from 'openai';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from './lib/utils';

interface Competitor {
  name: string;
  description: string;
  headquarters: string;
  revenue: string;
}

interface Application {
  name: string;
  description: string;
  marketSize: string;
  growthRate: string;
}

interface CustomerPersona {
  name: string;
  description: string;
  caresMostAbout: string;
  caresLeastAbout: string;
  potentialCustomers: string[];
  salesEmail?: string;
  discoveryEmail?: string;
}

interface MarketData {
  competitors: Competitor[];
  applications: Application[];
  customerPersonas: CustomerPersona[];
  rawData: {
    prompt: string;
    response: string;
  };
}

function App() {
  const [productName, setProductName] = useState('');
  const [location, setLocation] = useState('');
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('competitors');

  const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
  });

  const parseCompetitors = (text: string): Competitor[] => {
    const competitors: Competitor[] = [];
    const sections = text.split(/\d+\.\s+/);
    
    for (const section of sections) {
      if (!section.trim()) continue;
      
      const lines = section.split('\n');
      const competitor: Partial<Competitor> = {};
      
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':').map(part => part.trim());
        const value = valueParts.join(':').trim();
        
        if (!key || !value) continue;
        
        switch (key.toLowerCase()) {
          case 'name':
            competitor.name = value;
            break;
          case 'description':
            competitor.description = value;
            break;
          case 'headquarters':
            competitor.headquarters = value;
            break;
          case 'revenue':
            competitor.revenue = value;
            break;
        }
      }
      
      if (competitor.name && competitor.description && 
          competitor.headquarters && competitor.revenue) {
        competitors.push(competitor as Competitor);
      }
    }
    
    return competitors;
  };

  const parseApplications = (text: string): Application[] => {
    const applications: Application[] = [];
    const sections = text.split(/\d+\.\s+/);
    
    for (const section of sections) {
      if (!section.trim()) continue;
      
      const lines = section.split('\n');
      const application: Partial<Application> = {};
      
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':').map(part => part.trim());
        const value = valueParts.join(':').trim();
        
        if (!key || !value) continue;
        
        switch (key.toLowerCase()) {
          case 'name':
            application.name = value;
            break;
          case 'description':
            application.description = value;
            break;
          case 'market size':
            application.marketSize = value;
            break;
          case 'growth rate':
            application.growthRate = value;
            break;
        }
      }
      
      if (application.name && application.description && 
          application.marketSize && application.growthRate) {
        applications.push(application as Application);
      }
    }
    
    return applications;
  };

  const parseCustomerPersonas = (text: string, customersText: string): CustomerPersona[] => {
    const personas: CustomerPersona[] = [];
    const sections = text.split(/\d+\.\s+/);
    
    for (const section of sections) {
      if (!section.trim()) continue;
      
      const lines = section.split('\n');
      const persona: Partial<CustomerPersona> = {
        potentialCustomers: []
      };
      
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':').map(part => part.trim());
        const value = valueParts.join(':').trim();
        
        if (!key || !value) continue;
        
        switch (key.toLowerCase()) {
          case 'name':
            persona.name = value;
            break;
          case 'description':
            persona.description = value;
            break;
          case 'cares most about':
            persona.caresMostAbout = value;
            break;
          case 'cares least about':
            persona.caresLeastAbout = value;
            break;
        }
      }
      
      if (persona.name && persona.description && 
          persona.caresMostAbout && persona.caresLeastAbout) {
        // Extract potential customers for this persona from the customers section
        const customerLines = customersText.split('\n');
        const relevantCustomers = customerLines
          .filter(line => line.toLowerCase().includes(persona.name?.toLowerCase() || ''))
          .map(line => line.split('-')[0].trim())
          .filter(customer => customer.length > 0);
        
        persona.potentialCustomers = relevantCustomers;
        personas.push(persona as CustomerPersona);
      }
    }
    
    return personas.map(persona => ({
      ...persona,
      salesEmail: generateSalesEmail(persona, productName),
      discoveryEmail: generateDiscoveryEmail(persona, productName)
    }));
  };

  const generateSalesEmail = (persona: CustomerPersona, productName: string): string => {
    return `Subject: Streamline Your ${persona.name}'s Workflow with ${productName}

Dear [Name],

I hope this email finds you well. I understand that as a ${persona.name}, you're focused on ${persona.caresMostAbout}.

${productName} was specifically designed to address these priorities while eliminating concerns about ${persona.caresLeastAbout}.

I'd love to schedule a brief 30-minute call to show you how ${productName} can help you:
- Maximize ${persona.caresMostAbout.split(',')[0]}
- Streamline your workflow
- Achieve better results with less effort

Would you be available for a quick call this week? I have slots open on Tuesday at 2 PM or Thursday at 10 AM.

Best regards,
[Your name]`;
  };

  const generateDiscoveryEmail = (persona: CustomerPersona, productName: string): string => {
    return `Subject: Quick question about your ${persona.name} challenges

Hi [Name],

I'm reaching out because we've been working with several ${persona.name}s who are dealing with challenges around ${persona.caresMostAbout}.

I'd love to learn more about:
- How you're currently handling these challenges
- What solutions you've tried before
- What would make the biggest impact on your workflow

Would you be open to a 15-minute conversation to share your insights? Your experience would be invaluable for our research.

Best regards,
[Your name]`;
  };

  const analyzeProduct = async () => {
    if (!productName.trim()) {
      setError('Please enter a product name');
      return;
    }

    if (!location.trim()) {
      setError('Please enter a location');
      return;
    }

    setLoading(true);
    setError(null);
    setMarketData(null);
    
    try {
      if (!import.meta.env.VITE_OPENAI_API_KEY) {
        throw new Error('OpenAI API key is not configured');
      }

      const prompt = `Analyze the following product and provide a detailed market analysis specific to the ${location} market.

Product: ${productName}
Location: ${location}

Please consider local market conditions, regional competitors, and specific opportunities in ${location}. Include information about:
- Local market dynamics
- Regional pricing strategies
- Local customer preferences
- Cultural considerations that might affect product adoption
- Local regulations or compliance requirements

Format your response EXACTLY as follows:

1. Competitors:

1. Name: [Company Name]
Description: [Brief description with focus on ${location} presence]
Headquarters: [City, Country]
Revenue: [Annual revenue in USD]

2. Name: [Company Name]
Description: [Brief description with focus on ${location} presence]
Headquarters: [City, Country]
Revenue: [Annual revenue in USD]

[Continue for at least 7 competitors with presence or impact in ${location}...]

2. Product Applications:

1. Name: [Application Name]
Description: [Detailed description with ${location}-specific use cases]
Market Size: [Total addressable market size in USD for ${location}]
Growth Rate: [Annual growth rate as percentage in ${location}]

[Continue for at least 5 applications relevant to ${location}...]

3. Customer Personas:

1. Name: [Persona Name/Title]
Description: [Detailed description focused on ${location} market]
Cares Most About: [Top priorities specific to ${location}]
Cares Least About: [Lower priorities in ${location} context]

[Continue for at least 5 personas common in ${location}...]

4. Potential Customers:

1. [Specific role/title] at [${location}-based Company] - [Detailed explanation of fit and benefits]
2. [Specific role/title] at [${location}-based Company] - [Detailed explanation of fit and benefits]
[Continue for at least 10 specific roles from ${location}-based organizations...]`;

      const completion = await openai.chat.completions.create({
        messages: [{ 
          role: "system",
          content: "You are a market research expert who provides detailed, structured analysis. Always format your responses exactly as requested, with clear section numbering and consistent labeling. Focus on providing location-specific insights and data."
        },
        { 
          role: "user", 
          content: prompt
        }],
        model: "gpt-3.5-turbo",
        temperature: 0.7,
        max_tokens: 2500
      });

      const response = completion.choices[0]?.message?.content;
      
      if (!response) {
        throw new Error('No response received from OpenAI');
      }

      const sections = response.split(/(?=\d+\.\s+(?:Competitors|Product Applications|Customer Personas|Potential Customers):)/);
      
      let competitorsSection = '';
      let applicationsSection = '';
      let personasSection = '';
      let customersSection = '';

      for (const section of sections) {
        if (section.includes('Competitors:')) {
          competitorsSection = section;
        } else if (section.includes('Product Applications:')) {
          applicationsSection = section;
        } else if (section.includes('Customer Personas:')) {
          personasSection = section;
        } else if (section.includes('Potential Customers:')) {
          customersSection = section;
        }
      }

      const competitors = parseCompetitors(competitorsSection);
      const applications = parseApplications(applicationsSection);
      const customerPersonas = parseCustomerPersonas(personasSection, customersSection);

      setMarketData({
        competitors,
        applications,
        customerPersonas,
        rawData: {
          prompt,
          response
        }
      });
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const TabTrigger = ({ value, icon: Icon, label }: { value: string; icon: React.ElementType; label: string }) => (
    <Tabs.Trigger
      value={value}
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
        'border-b-2 border-transparent hover:border-gray-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'data-[state=active]:border-blue-600 data-[state=active]:text-blue-600'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Tabs.Trigger>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
            Comprehensive Market Analysis Dashboard
          </h1>

          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Enter product name..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter location..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>
              <button
                onClick={analyzeProduct}
                disabled={loading}
                className={`px-6 py-2 bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 min-w-[120px]
                  ${loading ? 'bg-blue-400 cursor-not-allowed' : 'hover:bg-blue-700'}`}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-red-600 text-sm">{error}</p>
            )}
          </div>

          {marketData && (
            <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="bg-white rounded-lg shadow-md">
              <Tabs.List className="flex border-b border-gray-200 px-4">
                <TabTrigger value="competitors" icon={Building2} label="Top Competitors" />
                <TabTrigger value="applications" icon={Briefcase} label="Product Applications" />
                <TabTrigger value="personas" icon={Users} label="Customer Personas" />
                <TabTrigger value="emails" icon={Mail} label="Email Templates" />
                <TabTrigger value="raw" icon={Code} label="Raw Data" />
              </Tabs.List>

              <div className="p-6">
                <Tabs.Content value="competitors" className="space-y-6">
                  {marketData.competitors.map((competitor, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <h3 className="font-medium text-gray-800 text-lg">{competitor.name}</h3>
                      <p className="text-sm text-gray-600 mt-2">{competitor.description}</p>
                      <div className="mt-3 grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs font-medium text-gray-500 block">HEADQUARTERS</span>
                          <p className="text-sm text-gray-700">{competitor.headquarters}</p>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-500 block">REVENUE</span>
                          <p className="text-sm text-gray-700">{competitor.revenue}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </Tabs.Content>

                <Tabs.Content value="applications" className="space-y-6">
                  {marketData.applications.map((application, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <h3 className="font-medium text-gray-800 text-lg">{application.name}</h3>
                      <p className="text-sm text-gray-600 mt-2">{application.description}</p>
                      <div className="mt-3 grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs font-medium text-gray-500 block">MARKET SIZE</span>
                          <p className="text-sm text-gray-700">{application.marketSize}</p>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-500 block">GROWTH RATE</span>
                          <p className="text-sm text-gray-700">{application.growthRate}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </Tabs.Content>

                <Tabs.Content value="personas" className="space-y-8">
                  {marketData.customerPersonas.map((persona, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-6 border border-gray-100">
                      <div className="mb-6">
                        <h3 className="font-medium text-gray-800 text-xl mb-2">{persona.name}</h3>
                        <p className="text-gray-600">{persona.description}</p>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">PRIORITIES</h4>
                          <div className="space-y-4">
                            <div className="bg-white p-3 rounded border border-gray-200">
                              <span className="text-xs font-medium text-green-600 block mb-1">CARES MOST ABOUT</span>
                              <p className="text-sm text-gray-800">{persona.caresMostAbout}</p>
                            </div>
                            <div className="bg-white p-3 rounded border border-gray-200">
                              <span className="text-xs font-medium text-red-600 block mb-1">CARES LEAST ABOUT</span>
                              <p className="text-sm text-gray-800">{persona.caresLeastAbout}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">POTENTIAL CUSTOMERS</h4>
                          <div className="bg-white p-3 rounded border border-gray-200">
                            <ul className="space-y-2">
                              {persona.potentialCustomers.map((customer, idx) => (
                                <li key={idx} className="text-sm text-gray-800 flex items-center gap-2">
                                  <Building className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  {customer}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </Tabs.Content>

                <Tabs.Content value="emails" className="space-y-8">
                  {marketData.customerPersonas.map((persona, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-6 border border-gray-100">
                      <h3 className="font-medium text-gray-800 text-xl mb-6">
                        Email Templates for {persona.name}
                      </h3>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-700">Sales Email</h4>
                          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
                              <span className="text-sm font-medium text-gray-600">Subject Line</span>
                            </div>
                            <div className="p-4">
                              <pre className="whitespace-pre-wrap text-sm font-sans text-gray-800">
                                {persona.salesEmail}
                              </pre>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-700">Discovery Email</h4>
                          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
                              <span className="text-sm font-medium text-gray-600">Subject Line</span>
                            </div>
                            <div className="p-4">
                              <pre className="whitespace-pre-wrap text-sm font-sans text-gray-800">
                                {persona.discoveryEmail}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </Tabs.Content>

                <Tabs.Content value="raw" className="space-y-8">
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-100">
                    <h3 className="font-medium text-gray-800 text-xl mb-6">OpenAI Prompt</h3>
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
                        <span className="text-sm font-medium text-gray-600">System Message</span>
                      </div>
                      <div className="p-4">
                        <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800">
                          {marketData.rawData.prompt}
                        </pre>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-100">
                    <h3 className="font-medium text-gray-800 text-xl mb-6">OpenAI Response</h3>
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
                        <span className="text-sm font-medium text-gray-600">Raw Output</span>
                      </div>
                      <div className="p-4">
                        <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800">
                          {marketData.rawData.response}
                        </pre>
                      </div>
                    </div>
                  </div>
                </Tabs.Content>
              </div>
            </Tabs.Root>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;