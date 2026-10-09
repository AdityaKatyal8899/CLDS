"""Base discovery provider interface for CLDS."""

from abc import ABC, abstractmethod
from typing import List
from clds.models import BusinessLead, SearchCriteria


class BaseDiscoveryProvider(ABC):
    """Abstract base class for all business discovery providers."""

    @abstractmethod
    def search(self, criteria: SearchCriteria) -> List[BusinessLead]:
        """
        Discover businesses matching search criteria.
        
        Args:
            criteria: SearchCriteria containing category, country, city, state, limit.
            
        Returns:
            List of validated BusinessLead instances.
        """
        raise NotImplementedError
