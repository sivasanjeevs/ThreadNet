# ThreadNet C++ Backend
CXX = g++
CXXFLAGS = -std=c++11 -pthread -Wall

.PHONY: all clean server client loadbalancer

all: server client loadbalancer

server: server.cpp
	$(CXX) $(CXXFLAGS) server.cpp -o server

client: client.cpp
	$(CXX) $(CXXFLAGS) client.cpp -o client

loadbalancer: loadbalancer.cpp
	$(CXX) $(CXXFLAGS) loadbalancer.cpp -o loadbalancer

clean:
	rm -f server client loadbalancer
