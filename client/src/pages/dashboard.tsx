import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { SearchSection, type Filters } from "@/components/search-section";
import { QueryCard } from "@/components/query-card";
import { AddQueryForm } from "@/components/add-query-form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Share2, Link2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Query } from "@shared/schema";
import { useLocation, useRoute } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// Define types for the route params to avoid TypeScript errors
interface FilterRouteParams {
  topic?: string;
  date?: string;
  employee?: string;
}

interface NamedRouteParams extends FilterRouteParams {
  name: string;
}

export default function DashboardPage() {
  const { isAuthenticated, checkAuthStatus, employeeId } = useAuth();
  const [, navigate] = useLocation();
  const [matchedFilter, filterParams] = useRoute<FilterRouteParams>('/filter/:topic?/:date?/:employee?');
  const [matchedNamed, namedParams] = useRoute<NamedRouteParams>('/view/:name/:topic?/:date?/:employee?');
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const [filters, setFilters] = useState<Filters>({
    topic: "all_topics",
    date: "all_time",
    employee: "all_employees",
  });
  
  // State for the share modal
  const [nameForSharing, setNameForSharing] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Check authentication when component mounts
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);
  
  // Redirect if not authenticated
  useEffect(() => {
    if (isAuthenticated === false) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);
  
  // Load filters from URL if available
  useEffect(() => {
    if ((matchedFilter && filterParams) || (matchedNamed && namedParams)) {
      const newFilters = { ...filters };
      
      // Extract parameters from the matched route
      const routeParams = matchedFilter ? filterParams : namedParams;
      
      if (routeParams.topic && routeParams.topic !== 'all_topics') {
        newFilters.topic = routeParams.topic;
      }
      
      if (routeParams.date && routeParams.date !== 'all_time') {
        newFilters.date = routeParams.date;
      }
      
      if (routeParams.employee && routeParams.employee !== 'all_employees') {
        newFilters.employee = routeParams.employee;
      }
      
      setFilters(newFilters);
    }
  }, [matchedFilter, matchedNamed, filterParams, namedParams, filters]);

  // Fetch queries with search and filters
  const { data: queries = [], isLoading } = useQuery<Query[]>({
    queryKey: [
      "/api/queries", 
      { 
        search: searchTerm || '',
        topic: filters.topic || 'all_topics',
        date: filters.date || 'all_time',
        employee: filters.employee || 'all_employees'
      }
    ],
  });

  // Handle search change
  const handleSearch = (search: string) => {
    setSearchTerm(search);
  };

  // Handle filter change 
  const handleFilterChange = (newFilters: Filters) => {
    // Store filters as received from the search component
    setFilters(newFilters);
    
    // Update URL with the new filters for bookmarking/sharing
    const topic = newFilters.topic !== 'all_topics' ? newFilters.topic : 'all_topics';
    const date = newFilters.date !== 'all_time' ? newFilters.date : 'all_time';
    const employee = newFilters.employee !== 'all_employees' ? newFilters.employee : 'all_employees';
    
    // Only navigate if at least one filter is not the default
    if (topic !== 'all_topics' || date !== 'all_time' || employee !== 'all_employees') {
      navigate(`/filter/${topic}/${date}/${employee}`);
    } else {
      // If all filters are default, navigate back to home
      navigate('/');
    }
  };

  // Toggle add query form
  const toggleAddForm = () => {
    setShowAddForm(!showAddForm);
  };
  
  // Open the share dialog
  const shareCurrentView = () => {
    setShowShareModal(true);
  };
  
  // Generate and copy a custom URL with name
  const generateAndCopyNamedUrl = () => {
    // Make sure we have a name to use
    if (!nameForSharing.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name to create a personalized link.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    // Format the name for URL (replace spaces with hyphens, remove special chars)
    const formattedName = nameForSharing.trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    
    const topic = filters.topic;
    const date = filters.date;
    const employee = filters.employee;
    
    // Create named URL
    const shareUrl = `${window.location.origin}/view/${formattedName}/${topic}/${date}/${employee}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setShowShareModal(false);
        toast({
          title: "Personalized link copied!",
          description: `Your personalized link with the name "${nameForSharing}" has been copied to your clipboard.`,
          duration: 3000,
        });
      })
      .catch(err => {
        console.error('Failed to copy link:', err);
        toast({
          title: "Copy failed",
          description: "Could not copy the link. Please try again.",
          variant: "destructive",
          duration: 3000,
        });
      });
  };

  return (
    <>
      <div className="flex flex-col min-h-screen bg-neutral-100">
        <Header />
        
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <SearchSection 
            onSearch={handleSearch} 
            onFilterChange={handleFilterChange}
          />
          
          <section className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-neutral-700">Results</h2>
              <div className="flex gap-2">
                <Button 
                  onClick={shareCurrentView}
                  variant="outline"
                  className="inline-flex items-center"
                >
                  <Share2 className="mr-2 h-4 w-4" /> Share View
                </Button>
                <Button 
                  onClick={toggleAddForm}
                  className="inline-flex items-center"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add New Query
                </Button>
              </div>
            </div>

            {showAddForm && <AddQueryForm onClose={() => setShowAddForm(false)} />}
            
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg h-48 animate-pulse" />
                ))}
              </div>
            ) : queries.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                <i className="fas fa-search text-neutral-300 text-4xl mb-2"></i>
                <p className="text-neutral-500">No queries found matching your search criteria.</p>
                <p className="text-neutral-400 text-sm mt-1">Try adjusting your search terms or filters.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {queries.map((query) => (
                  <QueryCard key={query.id} query={query} />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
      
      {/* Share Dialog */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create personalized share link</DialogTitle>
            <DialogDescription>
              Enter your name to create a custom URL that you can share with others.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Your Name
              </Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={nameForSharing}
                onChange={(e) => setNameForSharing(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="secondary" onClick={() => setShowShareModal(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={generateAndCopyNamedUrl}>
              <Link2 className="mr-2 h-4 w-4" />
              Generate & Copy Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}